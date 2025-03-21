/**********************************************************************
 * Copyright (C) 2024-2025 Red Hat, Inc.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 * http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 *
 * SPDX-License-Identifier: Apache-2.0
 ***********************************************************************/

import type {
  ContainerProviderConnection,
  Disposable,
  Event,
  RegisterContainerConnectionEvent,
  UpdateContainerConnectionEvent,
  RunResult,
  RunOptions,
  ProviderContainerConnection,
} from '@podman-desktop/api';
import { containerEngine, env, navigation, EventEmitter, process, provider, extensions } from '@podman-desktop/api';
import { getPodmanMachineName, type MachineJSON, MIN_CPUS_VALUE, getPodmanCli } from '../utils/podman';
import { VMType } from '@shared/models/IPodman';
import { Publisher } from '../utils/Publisher';
import type {
  CheckContainerConnectionResourcesOptions,
  ContainerConnectionInfo,
  ContainerProviderConnectionInfo,
} from '@shared/models/IContainerConnectionInfo';
import { MSG_PODMAN_CONNECTION_UPDATE } from '@shared/Messages';
import type { RpcExtension } from '@shared/messages/MessageProxy';

export interface PodmanConnectionEvent {
  status: 'stopped' | 'started' | 'unregister' | 'register';
}

export interface PodmanRunOptions extends RunOptions {
  connection?: ProviderContainerConnection;
}

export class PodmanConnection extends Publisher<ContainerProviderConnectionInfo[]> implements Disposable {
  // Map of providerId with corresponding connections
  #providers: Map<string, ContainerProviderConnection[]>;
  #disposables: Disposable[];

  private readonly _onPodmanConnectionEvent = new EventEmitter<PodmanConnectionEvent>();
  readonly onPodmanConnectionEvent: Event<PodmanConnectionEvent> = this._onPodmanConnectionEvent.event;

  constructor(rpcExtension: RpcExtension) {
    super(rpcExtension, MSG_PODMAN_CONNECTION_UPDATE, () => this.getContainerProviderConnectionInfo());
    this.#providers = new Map();
    this.#disposables = [];
  }

  /**
   * Execute the podman cli with the arguments provided
   *
   * @example
   * ```
   * const result = await podman.execute(connection, ['machine', 'ls', '--format=json']);
   * ```
   * @param connection
   * @param args
   * @param options
   */
  execute(connection: ContainerProviderConnection, args: string[], options?: RunOptions): Promise<RunResult> {
    const podman = extensions.getExtension('podman-desktop.podman');
    if (!podman) {
      console.warn('cannot find podman extension api');
      return this.executeLegacy(args, options);
    }

    const podmanApi: {
      exec(args: string[], options?: PodmanRunOptions): Promise<RunResult>;
    } = podman.exports;

    return podmanApi.exec(args, {
      ...options,
      connection: this.getProviderContainerConnection(connection),
    });
  }

  /**
   * Execute a command inside the podman machine
   *
   * @example
   * ```
   * const result = await podman.executeSSH(connection, ['ls', '/dev']);
   * ```
   * @param connection
   * @param args
   * @param options
   */
  executeSSH(connection: ContainerProviderConnection, args: string[], options?: RunOptions): Promise<RunResult> {
    return this.execute(connection, ['machine', 'ssh', this.getNameLegacyCompatibility(connection), ...args], options);
  }

  /**
   * Before 1.13, the podman extension was not exposing any api.
   *
   * Therefore, to support old version we need to get the podman executable ourself
   * @deprecated
   */
  protected executeLegacy(args: string[], options?: RunOptions): Promise<RunResult> {
    return process.exec(getPodmanCli(), [...args], options);
  }

  /**
   * Before 1.13, the {@link ContainerProviderConnection.name} field was used as friendly user
   * field also.
   *
   * Therefore, we could have `Podman Machine Default` as name, where the real machine was `podman-machine-default`.
   * @param connection
   * @deprecated
   */
  protected getNameLegacyCompatibility(connection: ContainerProviderConnection): string {
    return getPodmanMachineName(connection);
  }

  getContainerProviderConnections(): ContainerProviderConnection[] {
    return Array.from(this.#providers.values()).flat();
  }

  /**
   * This method flatten the
   */
  getContainerProviderConnectionInfo(): ContainerProviderConnectionInfo[] {
    const output: ContainerProviderConnectionInfo[] = [];

    for (const [providerId, connections] of Array.from(this.#providers.entries())) {
      output.push(
        ...connections.map(
          (connection): ContainerProviderConnectionInfo => ({
            providerId: providerId,
            name: connection.name,
            vmType: this.parseVMType(connection.vmType),
            type: 'podman',
            status: connection.status(),
          }),
        ),
      );
    }

    return output;
  }

  init(): void {
    // setup listeners
    this.listen();

    this.refreshProviders();
  }

  dispose(): void {
    this.#disposables.forEach(disposable => disposable.dispose());
  }

  /**
   * This method allow us to get the ProviderContainerConnection given a ContainerProviderConnection
   * @param connection
   * @protected
   */
  protected getProviderContainerConnection(connection: ContainerProviderConnection): ProviderContainerConnection {
    const providers: ProviderContainerConnection[] = provider.getContainerConnections();

    const podmanProvider = providers
      .filter(({ connection }) => connection.type === 'podman')
      .find(provider => provider.connection.name === connection.name);
    if (!podmanProvider) throw new Error(`cannot find podman provider with connection name ${connection.name}`);

    return podmanProvider;
  }

  protected refreshProviders(): void {
    // clear all providers
    this.#providers.clear();

    const providers: ProviderContainerConnection[] = provider.getContainerConnections();

    // register the podman container connection
    providers
      .filter(({ connection }) => connection.type === 'podman')
      .forEach(({ providerId, connection }) => {
        this.#providers.set(providerId, [connection, ...(this.#providers.get(providerId) ?? [])]);
      });

    // notify
    this.notify();
  }

  private listen(): void {
    // capture unregister event
    this.#disposables.push(
      provider.onDidUnregisterContainerConnection(() => {
        this.refreshProviders();
        this._onPodmanConnectionEvent.fire({
          status: 'unregister',
        });
      }),
    );

    this.#disposables.push(
      provider.onDidRegisterContainerConnection(({ providerId, connection }: RegisterContainerConnectionEvent) => {
        if (connection.type !== 'podman') {
          return;
        }

        // update connection
        this.#providers.set(providerId, [connection, ...(this.#providers.get(providerId) ?? [])]);
        this.notify();
        this._onPodmanConnectionEvent.fire({
          status: 'register',
        });
      }),
    );

    this.#disposables.push(
      provider.onDidUpdateContainerConnection(({ status }: UpdateContainerConnectionEvent) => {
        switch (status) {
          case 'started':
          case 'stopped':
            this._onPodmanConnectionEvent.fire({
              status: status,
            });
            this.notify();
            break;
          default:
            break;
        }
      }),
    );

    this.#disposables.push(
      provider.onDidUpdateProvider(() => {
        this.refreshProviders();
      }),
    );
  }

  protected parseVMType(vmtype: string | undefined): VMType {
    if (!vmtype) return VMType.UNKNOWN;
    const type = Object.values(VMType).find(s => s === vmtype);
    if (type === undefined) {
      return VMType.UNKNOWN;
    }
    return type;
  }

  /**
   * Get the VMType of the podman machine
   * @param name the machine name, from {@link ContainerProviderConnection}
   * @deprecated should uses the `getContainerProviderConnectionInfo()`
   */
  async getVMType(name?: string): Promise<VMType> {
    const { stdout } = await process.exec(getPodmanCli(), ['machine', 'list', '--format', 'json']);

    const parsed: unknown = JSON.parse(stdout);
    if (!Array.isArray(parsed)) throw new Error('podman machine list provided a malformed response');
    if (parsed.length === 0 && name) throw new Error('podman machine list provided an empty array');
    // On Linux we might not have any machine
    if (parsed.length === 0) return VMType.UNKNOWN;
    if (parsed.length > 1 && !name)
      throw new Error('name need to be provided when more than one podman machine is configured.');

    let output: MachineJSON;
    if (name) {
      output = parsed.find(machine => typeof machine === 'object' && 'Name' in machine && machine.Name === name);
      if (!output) throw new Error(`cannot find matching podman machine with name ${name}`);
    } else {
      output = parsed[0];
    }

    return this.parseVMType(output.VMType);
  }

  getContainerProviderConnection(connection: ContainerProviderConnectionInfo): ContainerProviderConnection {
    const output = (this.#providers.get(connection.providerId) ?? []).find(
      mConnection => connection.name === mConnection.name,
    );
    if (!output) throw new Error(`no container provider connection found for connection name ${connection.name}`);
    return output;
  }

  findRunningContainerProviderConnection(): ContainerProviderConnection | undefined {
    for (const connections of Array.from(this.#providers.values())) {
      const result = connections.find(connection => connection.status() === 'started');
      if (result) return result;
    }
    return undefined;
  }

  /**
   * This method return the ContainerProviderConnection corresponding to an engineId
   * @param engineId
   */
  async getConnectionByEngineId(engineId: string): Promise<ContainerProviderConnection> {
    const connections = Array.from(this.#providers.values()).flat();
    for (const connection of connections) {
      const infos = await containerEngine.listInfos({ provider: connection });
      if (infos.length === 0) continue;

      if (infos[0].engineId === engineId) return connection;
    }
    throw new Error('connection not found');
  }

  async checkContainerConnectionStatusAndResources(
    options: CheckContainerConnectionResourcesOptions,
  ): Promise<ContainerConnectionInfo> {
    // starting from podman desktop 1.10 we have the navigate functions
    const hasNavigateFunction = !!navigation.navigateToResources;

    // if we do not precise the connection and are on linux we assume native usage
    if (env.isLinux && !options.connection) {
      return {
        status: 'native',
        canRedirect: hasNavigateFunction,
      };
    }

    let connection: ContainerProviderConnection | undefined = undefined;
    if (options.connection) {
      connection = this.getContainerProviderConnection(options.connection);
    } else {
      connection = this.findRunningContainerProviderConnection();
    }

    if (!connection) {
      return {
        status: 'no-machine',
        canRedirect: hasNavigateFunction,
      };
    }

    const engineInfos = await containerEngine.listInfos({
      provider: connection,
    });

    if (engineInfos.length === 0) {
      return {
        status: 'no-machine',
        canRedirect: hasNavigateFunction,
      };
    }

    const engineInfo = engineInfos[0];
    if (!engineInfo) {
      return {
        status: 'no-machine',
        canRedirect: hasNavigateFunction,
      };
    }

    const hasCpus = engineInfo.cpus !== undefined && engineInfo.cpus >= MIN_CPUS_VALUE;
    const multiplier = options.context === 'recipe' ? 1.25 : 1.1;

    const memoryExpected = options.model.memory * multiplier;

    let hasMemory: boolean = true;
    if (engineInfo.memory !== undefined && engineInfo.memoryUsed !== undefined) {
      hasMemory = engineInfo.memory - engineInfo.memoryUsed >= memoryExpected;
    }

    let memoryIdle: number = 0;
    if (engineInfo.memory !== undefined && engineInfo.memoryUsed !== undefined) {
      memoryIdle = engineInfo.memory - engineInfo.memoryUsed;
    }

    if (!hasCpus || !hasMemory) {
      return {
        name: connection.name,
        cpus: engineInfo.cpus ?? 0,
        memoryIdle: memoryIdle,
        cpusExpected: MIN_CPUS_VALUE,
        memoryExpected: memoryExpected,
        status: 'low-resources',
        canEdit: !!connection.lifecycle?.edit,
        canRedirect: hasNavigateFunction,
      };
    }

    return {
      name: connection.name,
      status: 'running',
      canRedirect: hasNavigateFunction,
    };
  }
}
