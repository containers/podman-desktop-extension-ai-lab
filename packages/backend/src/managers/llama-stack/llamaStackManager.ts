/**********************************************************************
 * Copyright (C) 2025 Red Hat, Inc.
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

import type { TaskRegistry } from '../../registries/TaskRegistry';
import {
  containerEngine,
  env,
  process,
  type ContainerInfo,
  type Disposable,
  type TelemetryLogger,
  type ContainerProviderConnection,
  type ContainerCreateOptions,
  type ImageInfo,
} from '@podman-desktop/api';
import type { PodmanConnection, PodmanConnectionEvent } from '../podmanConnection';
import llama_stack_images from '../../assets/llama-stack-images.json';
import llama_stack_playground_images from '../../assets/llama-stack-playground-images.json';
import { getImageInfo } from '../../utils/inferenceUtils';
import type { ContainerRegistry, ContainerEvent, ContainerHealthy } from '../../registries/ContainerRegistry';
import { DISABLE_SELINUX_LABEL_SECURITY_OPTION } from '../../utils/utils';
import { getRandomName } from '../../utils/randomUtils';
import type { LlamaStackContainerInfo, LlamaStackContainers } from '@shared/models/llama-stack/LlamaStackContainerInfo';
import { LLAMA_STACK_CONTAINER_TRACKINGID } from '@shared/models/llama-stack/LlamaStackContainerInfo';
import type { LlamaStackContainerConfiguration } from '@shared/models/llama-stack/LlamaStackContainerConfiguration';
import path from 'node:path';
import fs from 'node:fs/promises';
import type { ConfigurationRegistry } from '../../registries/ConfigurationRegistry';
import { getFreeRandomPort } from '../../utils/ports';
import { TaskRunner } from '../TaskRunner';
import type { ModelsManager } from '../modelsManager';
import { getPodmanCli, getPodmanMachineName } from '../../utils/podman';

export const LLAMA_STACK_CONTAINER_LABEL = 'ai-lab-llama-stack-container';
export const LLAMA_STACK_API_PORT_LABEL = 'ai-lab-llama-stack-api-port';
export const LLAMA_STACK_PLAYGROUND_PORT_LABEL = 'ai-lab-llama-stack-playground-port';
export const SECOND: number = 1_000_000_000;

/*
 * Get the local IP address of the Podman machine.
 * See https://learn.microsoft.com/en-us/windows/wsl/networking
 */
async function getLocalIPAddress(connection: ContainerProviderConnection): Promise<string> {
  const cli = getPodmanCli();
  const machineName = getPodmanMachineName(connection);
  const result = await process.exec(cli, [
    'machine',
    'ssh',
    machineName,
    'ip',
    'route',
    'show',
    '|',
    'grep',
    '-i',
    'default',
    '|',
    'awk',
    // eslint-disable-next-line quotes
    "'{print $3}'",
  ]);
  return result.stdout.trim();
}

export class LlamaStackManager implements Disposable {
  #initialized: boolean;
  #stack_containers: LlamaStackContainers | undefined;
  #creationInProgress = false;
  #disposables: Disposable[];
  #taskRunner: TaskRunner;

  constructor(
    private readonly appUserDirectory: string,
    private taskRegistry: TaskRegistry,
    private podmanConnection: PodmanConnection,
    private containerRegistry: ContainerRegistry,
    private configurationRegistry: ConfigurationRegistry,
    private telemetryLogger: TelemetryLogger,
    private modelsManager: ModelsManager,
  ) {
    this.#initialized = false;
    this.#disposables = [];
    this.#taskRunner = new TaskRunner(this.taskRegistry);
  }

  init(): void {
    this.#disposables.push(this.podmanConnection.onPodmanConnectionEvent(this.watchMachineEvent.bind(this)));
    this.#disposables.push(this.containerRegistry.onStartContainerEvent(this.onStartContainerEvent.bind(this)));
    this.#disposables.push(this.containerRegistry.onStopContainerEvent(this.onStopContainerEvent.bind(this)));
  }

  dispose(): void {
    this.#disposables.forEach(disposable => disposable.dispose());
    this.#disposables = [];
  }

  private async watchMachineEvent(event: PodmanConnectionEvent): Promise<void> {
    if (
      (event.status === 'started' && (!this.#stack_containers?.server || !this.#stack_containers?.playground)) ||
      (event.status === 'stopped' && (this.#stack_containers?.server || this.#stack_containers?.playground))
    ) {
      await this.refreshLlamaStackContainers();
    }
  }

  private async onStartContainerEvent(): Promise<void> {
    await this.refreshLlamaStackContainers();
  }

  private async onStopContainerEvent(event: ContainerEvent): Promise<void> {
    const serverId = this.#stack_containers?.server?.containerId;
    const playgroundId = this.#stack_containers?.playground?.containerId;

    console.log('event id:', event.id, ' serverId: ', serverId, ' playgroundId: ', playgroundId);

    if (this.#creationInProgress) return;

    if (serverId === event.id || playgroundId === event.id) {
      this.#stack_containers = undefined;
      this.taskRegistry.deleteByLabels({ trackingId: LLAMA_STACK_CONTAINER_TRACKINGID });
    }

    await this.refreshLlamaStackContainers();
  }

  /**
   * getLlamaStackContainers returns the first running container with a Llama Stack label.
   * The container is searched only the first time and the result is cached for subsequent calls.
   *
   * Returns undefined if no container is found
   */
  async getLlamaStackContainers(): Promise<LlamaStackContainers | undefined> {
    if (!this.#initialized) {
      await this.refreshLlamaStackContainers();
      this.#initialized = true;
    }
    return this.#stack_containers;
  }

  /**
   * refreshLlamaStackContainers refreshes the container info.
   * It is called when the machine is started or when a container is stopped.
   */
  protected async refreshLlamaStackContainers(): Promise<void> {
    const containers = await containerEngine.listContainers();

    const serverContainer = containers.find(c => c.Labels && LLAMA_STACK_API_PORT_LABEL in c.Labels);
    let serverInfo: LlamaStackContainerInfo | undefined;

    if (serverContainer) {
      serverInfo = {
        containerId: serverContainer.Id,
        port: parseInt(serverContainer.Labels[LLAMA_STACK_API_PORT_LABEL], 10),
        state: serverContainer.State,
      };
    }

    const playgroundContainer = containers.find(c => c.Labels && LLAMA_STACK_PLAYGROUND_PORT_LABEL in c.Labels);
    let playgroundInfo: LlamaStackContainerInfo | undefined;

    if (playgroundContainer) {
      playgroundInfo = {
        containerId: playgroundContainer.Id,
        port: parseInt(playgroundContainer.Labels[LLAMA_STACK_PLAYGROUND_PORT_LABEL], 10),
        state: playgroundContainer.State,
      };
    }

    this.#stack_containers = {
      server: serverInfo,
      playground: playgroundInfo,
    };
  }

  /**
   * requestcreateLlamaStackContainerss creates the Llama Stack containers.
   * It is called when the user clicks the "Start" button.
   *
   * Flowchart for checking containers and handling them:
   *
   * Server exists
   *   ├─ Playground exists
   *   │    └─ Start both
   *   └─ Playground doesn't exist
   *        └─ Create new playground
   *
   * Server doesn't exist
   *   ├─ Playground exists
   *   │    └─ Delete playground and update state
   *   └─ Playground doesn't exist
   *        └─ Create both
   */
  async requestcreateLlamaStackContainerss(config: LlamaStackContainerConfiguration): Promise<void> {
    const connection: ContainerProviderConnection | undefined = config.connection
      ? this.podmanConnection.getContainerProviderConnection(config.connection)
      : this.podmanConnection.findRunningContainerProviderConnection();

    if (!connection) throw new Error('Cannot find running container provider connection');

    const labels = { trackingId: LLAMA_STACK_CONTAINER_TRACKINGID };
    const containers = await containerEngine.listContainers();
    const server = containers.find(c => c.Labels && LLAMA_STACK_API_PORT_LABEL in c.Labels);
    const playground = containers.find(c => c.Labels && LLAMA_STACK_PLAYGROUND_PORT_LABEL in c.Labels);

    try {
      if (server) {
        if (playground) {
          await this.startBoth(server, playground, labels);
        } else {
          await this.createPlaygroundFromServer(server, labels, connection);
        }
      } else {
        this.#creationInProgress = true;
        await this.CreateBoth(playground, labels, connection);
        this.#creationInProgress = false;
      }
    } catch (err) {
      this.telemetryLogger.logError('llamaStack.startContainer', { error: err });
    }
  }

  /**
   * Helper: Both server and playground exist → start both
   */
  private async startBoth(
    server: ContainerInfo,
    playground: ContainerInfo,
    labels: { [p: string]: string },
  ): Promise<void> {
    await this.#taskRunner.runAsTask(
      labels,
      {
        loadingLabel: 'Starting server and playground',
        errorMsg: err => `Failed to start existing containers: ${String(err)}`,
      },
      async ({ updateLabels }) => {
        if (server.State !== 'running') await containerEngine.startContainer(server.engineId, server.Id);
        if (playground.State !== 'running') await containerEngine.startContainer(playground.engineId, playground.Id);

        const serverInfo = await this.waitLlamaStackServerHealthy(
          {
            containerId: server.Id,
            port: parseInt(server.Labels[LLAMA_STACK_API_PORT_LABEL], 10),
            state: server.State,
          },
          labels,
        );

        this.#stack_containers = {
          server: serverInfo,
          playground: {
            containerId: playground.Id,
            port: parseInt(playground.Labels[LLAMA_STACK_PLAYGROUND_PORT_LABEL], 10),
            state: 'running',
          },
        };

        updateLabels(l => ({
          ...l,
          containerId: serverInfo.containerId,
          port: `${serverInfo.port}`,
          state: serverInfo.state,
          playgroundId: playground.Id,
          playgroundPort: `${parseInt(playground.Labels[LLAMA_STACK_PLAYGROUND_PORT_LABEL], 10)}`,
          playgroundState: 'running',
        }));

        this.telemetryLogger.logUsage('llamaStack.startContainer');
      },
    );
  }

  /**
   * Helper: Only server exists → create playground
   */
  private async createPlaygroundFromServer(
    server: ContainerInfo,
    labels: { [p: string]: string },
    connection: ContainerProviderConnection,
  ): Promise<void> {
    await this.#taskRunner.runAsTask(
      labels,
      {
        loadingLabel: 'Creating playground container',
        errorMsg: err => `Failed to create playground: ${String(err)}`,
      },
      async ({ updateLabels }) => {
        if (server.State !== 'running') await containerEngine.startContainer(server.engineId, server.Id);

        const serverInfo = await this.waitLlamaStackServerHealthy(
          {
            containerId: server.Id,
            port: parseInt(server.Labels[LLAMA_STACK_API_PORT_LABEL], 10),
            state: server.State,
          },
          labels,
        );

        const playgroundInfo = await this.createPlaygroundContainer(serverInfo, labels, connection);

        this.#stack_containers = { server: serverInfo, playground: playgroundInfo };

        updateLabels(l => ({
          ...l,
          containerId: serverInfo.containerId,
          port: `${serverInfo.port}`,
          state: serverInfo.state,
          playgroundId: playgroundInfo.containerId,
          playgroundPort: `${playgroundInfo.port}`,
          playgroundState: playgroundInfo.state,
        }));

        this.telemetryLogger.logUsage('llamaStack.startContainer');
      },
    );
  }

  /**
   * Helper: Only playground exists → delete it and create both containers
   */
  private async CreateBoth(
    playground: ContainerInfo | undefined,
    labels: { [p: string]: string },
    connection: ContainerProviderConnection,
  ): Promise<void> {
    await this.#taskRunner.runAsTask(
      labels,
      {
        loadingLabel: 'Creating server and playground',
        errorMsg: err => `Failed to create Llama Stack containers: ${String(err)}`,
        failFastSubtasks: true,
      },
      async ({ updateLabels }) => {
        // If playground exists, stop & delete it
        if (playground) {
          if (playground.State === 'running') {
            await containerEngine.stopContainer(playground.engineId, playground.Id);
          }
          await containerEngine.deleteContainer(playground.engineId, playground.Id);
        }

        // Create new server + playground
        const stackInfo = await this.createLlamaStackContainers(connection, labels);
        this.#stack_containers = stackInfo;

        // Update task labels for UI
        updateLabels(l => ({
          ...l,
          containerId: stackInfo.server?.containerId ?? '',
          port: `${stackInfo.server?.port}`,
          state: stackInfo.server?.state ?? '',
          playgroundId: stackInfo.playground?.containerId ?? '',
          playgroundPort: `${stackInfo.playground?.port}`,
          playgroundState: stackInfo.playground?.state ?? '',
        }));

        this.telemetryLogger.logUsage('llamaStack.startContainer');
      },
    );
  }
  async createLlamaStackContainers(
    connection: ContainerProviderConnection,
    labels: { [p: string]: string },
  ): Promise<LlamaStackContainers> {
    const image = llama_stack_images.default;
    const imageInfo = await this.#taskRunner.runAsTask<ImageInfo>(
      labels,
      {
        loadingLabel: `Pulling ${image}.`,
        errorMsg: err => `Something went wrong while pulling ${image}: ${String(err)}`,
      },
      () => getImageInfo(connection, image, () => {}),
    );

    // Create the server container
    let serverInfo = await this.createServerContainer(connection, image, imageInfo, labels);
    serverInfo = await this.waitLlamaStackServerHealthy(serverInfo, labels);
    serverInfo = await this.registerModels(serverInfo, labels, connection);
    const playgroundInfo = await this.createPlaygroundContainer(serverInfo, labels, connection);

    // Return both in proper interface
    return {
      server: serverInfo,
      playground: playgroundInfo,
    };
  }

  private async createServerContainer(
    connection: ContainerProviderConnection,
    image: string,
    imageInfo: ImageInfo,
    labels: { [p: string]: string },
  ): Promise<LlamaStackContainerInfo> {
    const folder = await this.getLlamaStackContainersFolder();

    const aiLabApiHost =
      env.isWindows && connection.vmType === 'wsl' ? await getLocalIPAddress(connection) : 'host.docker.internal';
    const aiLabApiPort = this.configurationRegistry.getExtensionConfiguration().apiPort;
    const llamaStackApiPort = await getFreeRandomPort('0.0.0.0');

    const createContainerOptions: ContainerCreateOptions = {
      Image: imageInfo.Id,
      name: getRandomName('llama-stack'),
      Labels: {
        [LLAMA_STACK_CONTAINER_LABEL]: image,
        [LLAMA_STACK_API_PORT_LABEL]: `${llamaStackApiPort}`,
      },
      HostConfig: {
        AutoRemove: false,
        SecurityOpt: [DISABLE_SELINUX_LABEL_SECURITY_OPTION],
        Mounts: [
          {
            Target: '/app/.llama',
            Source: path.join(folder, '.llama'),
            Type: 'bind',
          },
        ],
        UsernsMode: 'keep-id:uid=0,gid=0',
        PortBindings: { '8321/tcp': [{ HostPort: `${llamaStackApiPort}` }] },
      },
      Env: [`PODMAN_AI_LAB_URL=http://${aiLabApiHost}:${aiLabApiPort}`],
      OpenStdin: true,
      start: true,
      HealthCheck: {
        Test: ['CMD-SHELL', `curl -sSf localhost:8321/v1/models > /dev/null`],
        Interval: SECOND * 5,
        Retries: 20,
      },
    };

    return this.#taskRunner.runAsTask<LlamaStackContainerInfo>(
      labels,
      {
        loadingLabel: 'Starting Llama Stack server container',
        errorMsg: err => `Something went wrong while creating server container: ${String(err)}`,
      },
      async () => {
        const { id } = await containerEngine.createContainer(imageInfo.engineId, createContainerOptions);
        return {
          containerId: id,
          port: llamaStackApiPort,
          state: 'starting',
        };
      },
    );
  }

  async waitLlamaStackServerHealthy(
    serverInfo: LlamaStackContainerInfo,
    labels: { [p: string]: string },
  ): Promise<LlamaStackContainerInfo> {
    return this.#taskRunner.runAsTask<LlamaStackContainerInfo>(
      labels,
      {
        loadingLabel: 'Waiting Llama Stack server to be healthy',
        errorMsg: err => `Something went wrong while checking server health: ${String(err)}`,
      },
      () =>
        new Promise((resolve, _reject) => {
          const disposable = this.containerRegistry.onHealthyContainerEvent((event: ContainerHealthy) => {
            if (event.id !== serverInfo.containerId) return;

            disposable.dispose();
            serverInfo.state = 'running';
            this.telemetryLogger.logUsage('llamaStack.startContainer');
            resolve(serverInfo);
          });
        }),
    );
  }

  async registerModels(
    serverInfo: LlamaStackContainerInfo,
    labels: { [p: string]: string },
    connection: ContainerProviderConnection,
  ): Promise<LlamaStackContainerInfo> {
    for (const model of this.modelsManager.getModelsInfo().filter(model => model.file)) {
      await this.#taskRunner.runAsTask(
        labels,
        {
          loadingLabel: `Registering model ${model.name}`,
          errorMsg: err => `Something went wrong while registering model: ${String(err)}`,
        },
        async () => {
          await this.podmanConnection.execute(connection, [
            'exec',
            serverInfo.containerId,
            'llama-stack-client',
            'models',
            'register',
            model.name,
          ]);
        },
      );
    }
    return serverInfo;
  }

  private async createPlaygroundContainer(
    serverInfo: LlamaStackContainerInfo,
    labels: { [p: string]: string },
    connection: ContainerProviderConnection,
  ): Promise<LlamaStackContainerInfo> {
    const image = llama_stack_playground_images.default;
    const imageInfo = await this.#taskRunner.runAsTask<ImageInfo>(
      labels,
      {
        loadingLabel: `Pulling ${image}.`,
        errorMsg: err => `Something went wrong while pulling ${image}: ${String(err)}`,
      },
      () => getImageInfo(connection, image, () => {}),
    );

    const playgroundPort = await getFreeRandomPort('0.0.0.0');

    const createContainerOptions: ContainerCreateOptions = {
      Image: imageInfo.Id,
      name: getRandomName('llama-stack-playground'),
      Labels: {
        [LLAMA_STACK_CONTAINER_LABEL]: image,
        [LLAMA_STACK_PLAYGROUND_PORT_LABEL]: `${playgroundPort}`,
      },
      HostConfig: {
        AutoRemove: false,
        PortBindings: { '8501/tcp': [{ HostPort: `${playgroundPort}` }] },
      },
      Env: [`LLAMA_STACK_ENDPOINT=http://host.containers.internal:${serverInfo.port}`],
      OpenStdin: true,
      start: true,
    };

    return this.#taskRunner.runAsTask<LlamaStackContainerInfo>(
      labels,
      {
        loadingLabel: 'Starting Llama Stack playground container',
        errorMsg: err => `Something went wrong while creating playground container: ${String(err)}`,
      },
      async () => {
        const { id } = await containerEngine.createContainer(imageInfo.engineId, createContainerOptions);
        return {
          containerId: id,
          port: playgroundPort,
          state: 'running',
        };
      },
    );
  }

  private async getLlamaStackContainersFolder(): Promise<string> {
    const llamaStackPath = path.join(this.appUserDirectory, 'llama-stack', 'container');
    await fs.mkdir(path.join(llamaStackPath, '.llama'), { recursive: true });
    return llamaStackPath;
  }

  // For tests only
  protected getContainersInfo(): LlamaStackContainers | undefined {
    return this.#stack_containers;
  }
}
