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
  type Disposable,
  type TelemetryLogger,
  containerEngine,
  type ContainerProviderConnection,
  type ContainerCreateOptions,
  type ImageInfo,
} from '@podman-desktop/api';
import type { PodmanConnection, PodmanConnectionEvent } from '../podmanConnection';
import llama_stack_images from '../../assets/llama-stack-images.json';
import { getImageInfo } from '../../utils/inferenceUtils';
import type { ContainerRegistry, ContainerEvent, ContainerHealthy } from '../../registries/ContainerRegistry';
import { DISABLE_SELINUX_LABEL_SECURITY_OPTION } from '../../utils/utils';
import { getRandomName } from '../../utils/randomUtils';
import type { LlamaStackContainerInfo } from '@shared/models/llama-stack/LlamaStackContainerInfo';
import { LLAMA_STACK_CONTAINER_TRACKINGID } from '@shared/models/llama-stack/LlamaStackContainerInfo';
import type { LlamaStackContainerConfiguration } from '@shared/models/llama-stack/LlamaStackContainerConfiguration';
import path from 'node:path';
import fs from 'node:fs/promises';
import type { ConfigurationRegistry } from '../../registries/ConfigurationRegistry';
import { getFreeRandomPort } from '../../utils/ports';
import { TaskRunner } from '../TaskRunner';
import type { ModelsManager } from '../modelsManager';

export const LLAMA_STACK_CONTAINER_LABEL = 'ai-lab-llama-stack-container';
export const LLAMA_STACK_API_PORT_LABEL = 'ai-lab-llama-stack-api-port';
export const SECOND: number = 1_000_000_000;

export class LlamaStackManager implements Disposable {
  #initialized: boolean;
  #containerInfo: LlamaStackContainerInfo | undefined;
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

  protected async refreshLlamaStackContainer(id?: string): Promise<void> {
    const containers = await containerEngine.listContainers();
    const containerInfo = containers
      .filter(c => !id || c.Id === id)
      .filter(c => c.State === 'running' && c.Labels && LLAMA_STACK_CONTAINER_LABEL in c.Labels)
      .at(0);
    if ((id && containerInfo) || !id) {
      this.#containerInfo = containerInfo
        ? {
            containerId: containerInfo.Id,
            port: parseInt(containerInfo.Labels[LLAMA_STACK_API_PORT_LABEL]),
          }
        : undefined;
    }
  }

  private async watchMachineEvent(event: PodmanConnectionEvent): Promise<void> {
    if ((event.status === 'started' && !this.#containerInfo) || (event.status === 'stopped' && this.#containerInfo)) {
      await this.refreshLlamaStackContainer();
    }
  }

  private async onStartContainerEvent(event: ContainerEvent): Promise<void> {
    await this.refreshLlamaStackContainer(event.id);
  }

  private onStopContainerEvent(event: ContainerEvent): void {
    console.log('event id:', event.id, ' containerId: ', this.#containerInfo?.containerId);
    if (this.#containerInfo?.containerId === event.id) {
      this.#containerInfo = undefined;
      this.taskRegistry.deleteByLabels({ trackingId: LLAMA_STACK_CONTAINER_TRACKINGID });
    }
  }

  /**
   * getLlamaStackContainer returns the first running container with a Llama Stack label.
   * The container is searched only the first time and the result is cached for subsequent calls.
   *
   * Returns undefined if no container is found
   */
  async getLlamaStackContainer(): Promise<LlamaStackContainerInfo | undefined> {
    if (!this.#initialized) {
      const containers = await containerEngine.listContainers();
      this.#containerInfo = containers
        .filter(c => c.State === 'running' && c.Labels && LLAMA_STACK_CONTAINER_LABEL in c.Labels)
        .map(c => ({
          containerId: c.Id,
          port: parseInt(c.Labels[LLAMA_STACK_API_PORT_LABEL]),
        }))
        .at(0);
      this.#initialized = true;
    }
    return this.#containerInfo;
  }

  async requestCreateLlamaStackContainer(config: LlamaStackContainerConfiguration): Promise<void> {
    let connection: ContainerProviderConnection | undefined;
    if (config.connection) {
      connection = this.podmanConnection.getContainerProviderConnection(config.connection);
    } else {
      connection = this.podmanConnection.findRunningContainerProviderConnection();
    }

    if (!connection) throw new Error('cannot find running container provider connection');

    // create a tracking id to put in the labels
    const trackingId: string = LLAMA_STACK_CONTAINER_TRACKINGID;

    const labels = {
      trackingId: trackingId,
    };

    this.#taskRunner
      .runAsTask(
        {
          trackingId: trackingId,
        },
        {
          loadingLabel: 'Creating Llama Stack container',
          errorMsg: err => `Something went wrong while trying to create an inference server ${String(err)}.`,
          failFastSubtasks: true,
        },
        async ({ updateLabels }) => {
          const containerInfo = await this.createLlamaStackContainer(connection, labels);
          this.#containerInfo = containerInfo;
          updateLabels(labels => ({
            ...labels,
            containerId: containerInfo.containerId,
            port: `${containerInfo.port}`,
          }));
          this.telemetryLogger.logUsage('llamaStack.startContainer');
        },
      )
      .catch((err: unknown) => {
        this.telemetryLogger.logError('llamaStack.startContainer', { error: err });
      });
  }

  async createLlamaStackContainer(
    connection: ContainerProviderConnection,
    labels: { [p: string]: string },
  ): Promise<LlamaStackContainerInfo> {
    const image = llama_stack_images.default;
    const imageInfo = await this.#taskRunner.runAsTask<ImageInfo>(
      labels,
      {
        loadingLabel: `Pulling ${image}.`,
        errorMsg: err => `Something went wrong while pulling ${image}: ${String(err)}`,
      },
      () => getImageInfo(connection, image, () => {}),
    );

    let containerInfo = await this.createContainer(image, imageInfo, labels);
    containerInfo = await this.waitLlamaStackContainerHealthy(containerInfo, labels);
    return this.registerModels(containerInfo, labels, connection);
  }

  private async createContainer(
    image: string,
    imageInfo: ImageInfo,
    labels: { [p: string]: string },
  ): Promise<LlamaStackContainerInfo> {
    const folder = await this.getLlamaStackContainerFolder();

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
        AutoRemove: true,
        SecurityOpt: [DISABLE_SELINUX_LABEL_SECURITY_OPTION],
        Mounts: [
          {
            Target: '/app/.llama',
            Source: path.join(folder, '.llama'),
            Type: 'bind',
          },
        ],
        UsernsMode: 'keep-id:uid=0,gid=0',
        PortBindings: {
          '8321/tcp': [
            {
              HostPort: `${llamaStackApiPort}`,
            },
          ],
        },
      },
      Env: [`PODMAN_AI_LAB_URL=http://host.containers.internal:${aiLabApiPort}`],
      OpenStdin: true,
      start: true,
      HealthCheck: {
        // must be the port INSIDE the container not the exposed one
        Test: ['CMD-SHELL', `curl -sSf localhost:8321/v1/models > /dev/null`],
        Interval: SECOND * 5,
        Retries: 4 * 5,
      },
    };

    return this.#taskRunner.runAsTask<LlamaStackContainerInfo>(
      labels,
      {
        loadingLabel: 'Starting Llama Stack container',
        errorMsg: err => `Something went wrong while creating container: ${String(err)}`,
      },
      async () => {
        const { id } = await containerEngine.createContainer(imageInfo.engineId, createContainerOptions);
        return {
          containerId: id,
          port: llamaStackApiPort,
        };
      },
    );
  }

  async waitLlamaStackContainerHealthy(
    containerInfo: LlamaStackContainerInfo,
    labels: { [p: string]: string },
  ): Promise<LlamaStackContainerInfo> {
    return this.#taskRunner.runAsTask<LlamaStackContainerInfo>(
      labels,
      {
        loadingLabel: 'Waiting Llama Stack to be started',
        errorMsg: err => `Something went wrong while trying to check container health check: ${String(err)}.`,
      },
      async ({ updateLabels }) => {
        let disposable: Disposable;
        return new Promise(resolve => {
          disposable = this.containerRegistry.onHealthyContainerEvent((event: ContainerHealthy) => {
            if (event.id !== containerInfo.containerId) {
              return;
            }
            disposable.dispose();
            // eslint-disable-next-line sonarjs/no-nested-functions
            updateLabels(labels => ({
              ...labels,
              containerId: containerInfo.containerId,
              port: `${containerInfo.port}`,
            }));
            this.telemetryLogger.logUsage('llamaStack.startContainer');
            resolve(containerInfo);
          });
        });
      },
    );
  }

  async registerModels(
    containerInfo: LlamaStackContainerInfo,
    labels: { [p: string]: string },
    connection: ContainerProviderConnection,
  ): Promise<LlamaStackContainerInfo> {
    for (const model of this.modelsManager.getModelsInfo().filter(model => model.file)) {
      await this.#taskRunner.runAsTask(
        labels,
        {
          loadingLabel: `Registering model ${model.name}`,
          errorMsg: err => `Something went wrong while registering model: ${String(err)}.`,
        },
        async () => {
          await this.podmanConnection.execute(connection, [
            'exec',
            containerInfo.containerId,
            'llama-stack-client',
            'models',
            'register',
            model.name,
          ]);
        },
      );
    }
    return containerInfo;
  }

  private async getLlamaStackContainerFolder(): Promise<string> {
    const llamaStackPath = path.join(this.appUserDirectory, 'llama-stack', 'container');
    await fs.mkdir(path.join(llamaStackPath, '.llama'), { recursive: true });
    return llamaStackPath;
  }

  // For tests only
  protected getContainerInfo(): LlamaStackContainerInfo | undefined {
    return this.#containerInfo;
  }
}
