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
  type TelemetryLogger,
  containerEngine,
  type ContainerProviderConnection,
  type ContainerCreateOptions,
} from '@podman-desktop/api';
import type { PodmanConnection, PodmanConnectionEvent } from '../podmanConnection';
import llama_stack_images from '../../assets/llama-stack-images.json';
import { getImageInfo } from '../../utils/inferenceUtils';
import type { ContainerRegistry, ContainerEvent } from '../../registries/ContainerRegistry';
import { DISABLE_SELINUX_LABEL_SECURITY_OPTION } from '../../utils/utils';
import { getRandomName } from '../../utils/randomUtils';
import type { LlamaStackContainerInfo } from '@shared/models/llama-stack/LlamaStackContainerInfo';
import { LLAMA_STACK_CONTAINER_TRACKINGID } from '@shared/models/llama-stack/LlamaStackContainerInfo';
import type { LlamaStackContainerConfiguration } from '@shared/models/llama-stack/LlamaStackContainerConfiguration';
import path from 'node:path';
import fs from 'node:fs/promises';
import type { ConfigurationRegistry } from '../../registries/ConfigurationRegistry';
import { getFreeRandomPort } from '../../utils/ports';

export const LLAMA_STACK_CONTAINER_LABEL = 'ai-lab-llama-stack-container';
export const LLAMA_STACK_API_PORT_LABEL = 'ai-lab-llama-stack-api-port';

export class LlamaStackManager {
  #initialized: boolean;
  #containerInfo: LlamaStackContainerInfo | undefined;

  constructor(
    private readonly appUserDirectory: string,
    private taskRegistry: TaskRegistry,
    private podmanConnection: PodmanConnection,
    private containerRegistry: ContainerRegistry,
    private configurationRegistry: ConfigurationRegistry,
    private telemetryLogger: TelemetryLogger,
  ) {
    this.#initialized = false;
    this.podmanConnection.onPodmanConnectionEvent(this.watchMachineEvent.bind(this));
    this.containerRegistry.onStartContainerEvent(this.onStartContainerEvent.bind(this));
    this.containerRegistry.onStopContainerEvent(this.onStopContainerEvent.bind(this));
  }

  private async refreshLlamaStackContainer(id?: string): Promise<void> {
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
    // create a tracking id to put in the labels
    const trackingId: string = LLAMA_STACK_CONTAINER_TRACKINGID;

    const labels = {
      trackingId: trackingId,
    };

    const task = this.taskRegistry.createTask('Creating Llama Stack container', 'loading', {
      trackingId: trackingId,
    });

    let connection: ContainerProviderConnection | undefined;
    if (config.connection) {
      connection = this.podmanConnection.getContainerProviderConnection(config.connection);
    } else {
      connection = this.podmanConnection.findRunningContainerProviderConnection();
    }

    if (!connection) throw new Error('cannot find running container provider connection');

    this.createLlamaStackContainer(connection, labels)
      .then((containerInfo: LlamaStackContainerInfo) => {
        this.#containerInfo = containerInfo;
        this.taskRegistry.updateTask({
          ...task,
          state: 'success',
          labels: {
            ...task.labels,
            containerId: containerInfo.containerId,
            port: `${containerInfo.port}`,
          },
        });
        this.telemetryLogger.logUsage('llamaStack.startContainer');
      })
      .catch((err: unknown) => {
        // Get all tasks using the tracker
        const tasks = this.taskRegistry.getTasksByLabels({
          trackingId: trackingId,
        });
        // Filter the one no in loading state
        tasks
          .filter(t => t.state === 'loading' && t.id !== task.id)
          .forEach(t => {
            this.taskRegistry.updateTask({
              ...t,
              state: 'error',
            });
          });
        // Update the main task
        this.taskRegistry.updateTask({
          ...task,
          state: 'error',
          error: `Something went wrong while trying to create an inference server ${String(err)}.`,
        });
        this.telemetryLogger.logError('llamaStack.startContainer', { error: err });
      });
  }

  async createLlamaStackContainer(
    connection: ContainerProviderConnection,
    labels: { [p: string]: string },
  ): Promise<LlamaStackContainerInfo> {
    const image = llama_stack_images.default;
    const pullingTask = this.taskRegistry.createTask(`Pulling ${image}.`, 'loading', labels);
    const imageInfo = await getImageInfo(connection, image, () => {})
      .catch((err: unknown) => {
        pullingTask.state = 'error';
        pullingTask.progress = undefined;
        pullingTask.error = `Something went wrong while pulling ${image}: ${String(err)}`;
        throw err;
      })
      .then(imageInfo => {
        pullingTask.state = 'success';
        pullingTask.progress = undefined;
        return imageInfo;
      })
      .finally(() => {
        this.taskRegistry.updateTask(pullingTask);
      });

    const folder = await this.getLlamaStackContainerFolder();

    const containerTask = this.taskRegistry.createTask('Starting Llama Stack container', 'loading', labels);
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
      Env: [`PODMAN_AI_LAB_URL=http://host.docker.internal:${aiLabApiPort}`],
      OpenStdin: true,
      start: true,
    };
    try {
      const { id } = await containerEngine.createContainer(imageInfo.engineId, createContainerOptions);
      // update the task
      containerTask.state = 'success';
      containerTask.progress = undefined;
      return {
        containerId: id,
        port: llamaStackApiPort,
      };
    } catch (err: unknown) {
      containerTask.state = 'error';
      containerTask.progress = undefined;
      containerTask.error = `Something went wrong while creating container: ${String(err)}`;
      throw err;
    } finally {
      this.taskRegistry.updateTask(containerTask);
    }
  }

  private async getLlamaStackContainerFolder(): Promise<string> {
    const llamaStackPath = path.join(this.appUserDirectory, 'llama-stack', 'container');
    await fs.mkdir(llamaStackPath, { recursive: true });
    await fs.mkdir(path.join(llamaStackPath, '.llama'), { recursive: true });
    return llamaStackPath;
  }
}
