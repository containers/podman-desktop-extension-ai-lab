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
import type { InferenceServer } from '@shared/src/models/IInference';
import type { PodmanConnection } from '../podmanConnection';
import { containerEngine, Disposable } from '@podman-desktop/api';
import {
  type ContainerInfo,
  type ImageInfo,
  type PullEvent,
  type TelemetryLogger,
  type Webview,
} from '@podman-desktop/api';
import type { ContainerRegistry, ContainerStart } from '../../registries/ContainerRegistry';
import {
  generateContainerCreateOptions,
  getImageInfo,
  getProviderContainerConnection,
  LABEL_INFERENCE_SERVER,
} from '../../utils/inferenceUtils';
import { Publisher } from '../../utils/Publisher';
import { Messages } from '@shared/Messages';
import type { InferenceServerConfig } from '@shared/src/models/InferenceServerConfig';
import type { ModelsManager } from '../modelsManager';

export class InferenceManager extends Publisher<InferenceServer[]> implements Disposable {
  // Inference server map (containerId -> InferenceServer)
  #servers: Map<string, InferenceServer>;
  // Is initialized
  #initialized: boolean;
  // Disposables
  #disposables: Disposable[];

  constructor(
    webview: Webview,
    private containerRegistry: ContainerRegistry,
    private podmanConnection: PodmanConnection,
    private modelsManager: ModelsManager,
    private telemetry: TelemetryLogger,
  ) {
    super(webview, Messages.MSG_INFERENCE_SERVERS_UPDATE, () => this.getServers());
    this.#servers = new Map<string, InferenceServer>();
    this.#disposables = [];
    this.#initialized = false;
  }

  init(): void {
    this.podmanConnection.onMachineStart(this.watchMachineEvent.bind(this, 'start'));
    this.podmanConnection.onMachineStop(this.watchMachineEvent.bind(this, 'stop'));
    this.containerRegistry.onStartContainerEvent(this.watchContainerStart.bind(this));

    this.retryableRefresh(3);
  }

  public isInitialize(): boolean {
    return this.#initialized;
  }

  /**
   * Cleanup the manager
   */
  dispose(): void {
    this.cleanDisposables();
    this.#servers.clear();
    this.#initialized = false;
  }

  /**
   * Clean class disposables
   */
  private cleanDisposables(): void {
    this.#disposables.forEach(disposable => disposable.dispose());
  }

  /**
   * Get the Inference servers
   */
  public getServers(): InferenceServer[] {
    return Array.from(this.#servers.values());
  }

  /**
   * return an inference server
   * @param containerId the containerId of the inference server
   */
  public get(containerId: string): InferenceServer | undefined {
    return this.#servers.get(containerId);
  }

  /**
   * Given an engineId, it will create an inference server.
   * @param config
   */
  async createInferenceServer(config: InferenceServerConfig): Promise<void> {
    if (!this.isInitialize()) throw new Error('Cannot start the inference server: not initialized.');

    // Fetch a provider container connection
    const provider = getProviderContainerConnection(config.providerId);

    // Get the image inspect info
    const imageInfo: ImageInfo = await getImageInfo(provider.connection, config.image, (_event: PullEvent) => {});

    // Create container on requested engine
    const result = await containerEngine.createContainer(
      imageInfo.engineId,
      generateContainerCreateOptions(config, imageInfo),
    );

    // Adding a new inference server
    this.#servers.set(result.id, {
      container: {
        engineId: imageInfo.engineId,
        containerId: result.id,
      },
      connection: {
        port: config.port,
      },
      status: 'running',
      models: config.modelsInfo,
    });

    // Watch for container changes
    this.watchContainerStatus(imageInfo.engineId, result.id);

    // Log usage
    this.telemetry.logUsage('inference.start', {
      models: config.modelsInfo.map(model => model.id),
    });

    this.notify();
  }

  /**
   * Given an engineId and a containerId, inspect the container and update the servers
   * @param engineId
   * @param containerId
   * @private
   */
  private updateServerStatus(engineId: string, containerId: string): void {
    // Inspect container
    containerEngine
      .inspectContainer(engineId, containerId)
      .then(result => {
        const server = this.#servers.get(containerId);
        if (server === undefined)
          throw new Error('Something went wrong while trying to get container status got undefined Inference Server.');

        // Update server
        this.#servers.set(containerId, {
          ...server,
          status: result.State.Status === 'running' ? 'running' : 'stopped',
          health: result.State.Health,
        });
        this.notify();
      })
      .catch((err: unknown) => {
        console.error(
          `Something went wrong while trying to inspect container ${containerId}. Trying to refresh servers.`,
          err,
        );
        this.retryableRefresh(2);
      });
  }

  /**
   * Watch for container status changes
   * @param engineId
   * @param containerId the container to watch out
   */
  private watchContainerStatus(engineId: string, containerId: string): void {
    // Update now
    this.updateServerStatus(engineId, containerId);

    // Create a pulling update for container health check
    const intervalId = setInterval(this.updateServerStatus.bind(this, engineId, containerId), 10000);

    this.#disposables.push(
      Disposable.create(() => {
        clearInterval(intervalId);
      }),
    );
    // Subscribe to container status update
    const disposable = this.containerRegistry.subscribe(containerId, (status: string) => {
      switch (status) {
        case 'remove':
          // Update the list of servers
          this.removeInferenceServer(containerId);
          disposable.dispose();
          clearInterval(intervalId);
          break;
      }
    });
    // Allowing cleanup if extension is stopped
    this.#disposables.push(disposable);
  }

  private watchMachineEvent(_event: 'start' | 'stop'): void {
    this.retryableRefresh(2);
  }

  /**
   * Listener for container start events
   * @param event the event containing the id of the container
   */
  private watchContainerStart(event: ContainerStart): void {
    // We might have a start event for an inference server we already know about
    if (this.#servers.has(event.id)) return;

    containerEngine
      .listContainers()
      .then(containers => {
        const container = containers.find(c => c.Id === event.id);
        if (container === undefined) {
          return;
        }
        if (container.Labels && LABEL_INFERENCE_SERVER in container.Labels) {
          this.watchContainerStatus(container.engineId, container.Id);
        }
      })
      .catch((err: unknown) => {
        console.error(`Something went wrong in container start listener.`, err);
      });
  }

  /**
   * This non-async utility method is made to retry refreshing the inference server with some delay
   * in case of error raised.
   *
   * @param retry the number of retry allowed
   */
  private retryableRefresh(retry: number = 3): void {
    if (retry === 0) {
      console.error('Cannot refresh inference servers: retry limit has been reached. Cleaning manager.');
      this.cleanDisposables();
      this.#servers.clear();
      this.#initialized = false;
      return;
    }
    this.refreshInferenceServers().catch((err: unknown): void => {
      console.warn(`Something went wrong while trying to refresh inference server. (retry left ${retry})`, err);
      setTimeout(
        () => {
          this.retryableRefresh(retry - 1);
        },
        2000 + Math.random() * 1000,
      );
    });
  }

  /**
   * Refresh the inference servers by listing all containers.
   *
   * This method has an important impact as it (re-)create all inference servers
   */
  private async refreshInferenceServers(): Promise<void> {
    const containers: ContainerInfo[] = await containerEngine.listContainers();
    const filtered = containers.filter(c => c.Labels && LABEL_INFERENCE_SERVER in c.Labels);

    // clean existing disposables
    this.cleanDisposables();
    this.#servers = new Map<string, InferenceServer>(
      filtered.map(containerInfo => {
        let modelsId: string[] = [];
        try {
          modelsId = JSON.parse(containerInfo.Labels[LABEL_INFERENCE_SERVER]);
        } catch (err: unknown) {
          console.error('Something went wrong while getting the models ids from the label.', err);
        }

        return [
          containerInfo.Id,
          {
            container: {
              containerId: containerInfo.Id,
              engineId: containerInfo.engineId,
            },
            connection: {
              port: !!containerInfo.Ports && containerInfo.Ports.length > 0 ? containerInfo.Ports[0].PublicPort : -1,
            },
            status: containerInfo.Status === 'running' ? 'running' : 'stopped',
            models: modelsId.map(id => this.modelsManager.getModelInfo(id)),
          },
        ];
      }),
    );

    // (re-)create container watchers
    this.#servers.forEach(server => this.watchContainerStatus(server.container.engineId, server.container.containerId));
    this.#initialized = true;
    // notify update
    this.notify();
  }

  /**
   * Remove the InferenceServer instance from #servers using the containerId
   * @param containerId the id of the container running the Inference Server
   */
  private removeInferenceServer(containerId: string): void {
    this.#servers.delete(containerId);
    this.notify();
  }

  /**
   * Start an inference server from the container id
   * @param containerId the identifier of the container to start
   */
  async startInferenceServer(containerId: string): Promise<void> {
    if (!this.isInitialize()) throw new Error('Cannot start the inference server.');

    const server = this.#servers.get(containerId);
    if (server === undefined) throw new Error(`cannot find a corresponding server for container id ${containerId}.`);

    try {
      await containerEngine.startContainer(server.container.engineId, server.container.containerId);
      this.#servers.set(server.container.containerId, {
        ...server,
        status: 'running',
        health: undefined, // remove existing health checks
      });
      this.notify();
    } catch (error: unknown) {
      console.error(error);
      this.telemetry.logError('inference.start', {
        message: 'error starting inference',
        error: error,
      });
    }
  }

  /**
   * Stop an inference server from the container id
   * @param containerId the identifier of the container to stop
   */
  async stopInferenceServer(containerId?: string): Promise<void> {
    if (!this.isInitialize()) throw new Error('Cannot stop the inference server.');

    const server = this.#servers.get(containerId);
    if (server === undefined) throw new Error(`cannot find a corresponding server for container id ${containerId}.`);

    try {
      await containerEngine.stopContainer(server.container.engineId, server.container.containerId);
      this.#servers.set(server.container.containerId, {
        ...server,
        status: 'stopped',
        health: undefined, // remove existing health checks
      });
      this.notify();
    } catch (error: unknown) {
      console.error(error);
      this.telemetry.logError('inference.stop', {
        message: 'error stopping inference',
        error: error,
      });
    }
  }
}
