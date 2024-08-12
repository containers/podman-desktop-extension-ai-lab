/**********************************************************************
 * Copyright (C) 2024 Red Hat, Inc.
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
  Webview,
} from '@podman-desktop/api';
import { EventEmitter, process, provider } from '@podman-desktop/api';
import type { MachineJSON } from '../utils/podman';
import { getPodmanCli } from '../utils/podman';
import { VMType } from '@shared/src/models/IPodman';
import { Publisher } from '../utils/Publisher';
import type { ContainerProviderConnectionInfo } from '@shared/src/models/IContainerConnectionInfo';
import { Messages } from '@shared/Messages';

export interface PodmanConnectionEvent {
  status: 'stopped' | 'started' | 'unregister' | 'register';
}

export class PodmanConnection extends Publisher<ContainerProviderConnectionInfo[]> implements Disposable {
  // Map of providerId with corresponding connections
  #providers: Map<string, ContainerProviderConnection[]>;
  #disposables: Disposable[];

  private readonly _onPodmanConnectionEvent = new EventEmitter<PodmanConnectionEvent>();
  readonly onPodmanConnectionEvent: Event<PodmanConnectionEvent> = this._onPodmanConnectionEvent.event;

  constructor(webview: Webview) {
    super(webview, Messages.MSG_PODMAN_CONNECTION_UPDATE, () => this.getContainerProviderConnectionInfo());
    this.#providers = new Map();
    this.#disposables = [];
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

  protected refreshProviders(): void {
    // clear all providers
    this.#providers.clear();

    const providers = provider.getContainerConnections();

    // register the podman container connection
    providers
      .filter(({ connection }) => connection.type === 'podman')
      .forEach(({ providerId, connection }) => {
        this.#providers.set(providerId, [connection, ...(this.#providers.get(providerId) ?? [])]);
      });

    // notify
    this.notify();
  }

  private listen() {
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
    const type = VMType[vmtype.toUpperCase() as keyof typeof VMType];
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
}
