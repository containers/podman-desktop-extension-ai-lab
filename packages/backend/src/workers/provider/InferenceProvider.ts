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
  ContainerCreateOptions,
  ContainerCreateResult,
  Disposable,
  ImageInfo,
  PullEvent,
} from '@podman-desktop/api';
import { containerEngine } from '@podman-desktop/api';
import type { InferenceServerConfig } from '@shared/src/models/InferenceServerConfig';
import type { IWorker } from '../IWorker';
import type { TaskRegistry } from '../../registries/TaskRegistry';
import { getImageInfo, getProviderContainerConnection } from '../../utils/inferenceUtils';

export abstract class InferenceProvider implements IWorker<InferenceServerConfig, ContainerCreateResult>, Disposable {
  protected constructor(private taskRegistry: TaskRegistry) {}

  abstract name: string;
  abstract enabled(): boolean;
  abstract perform(config: InferenceServerConfig): Promise<ContainerCreateResult>;
  abstract dispose(): void;

  protected async createContainer(
    engineId: string,
    containerCreateOptions: ContainerCreateOptions,
    labels: { [id: string]: string },
  ): Promise<ContainerCreateResult> {
    const containerTask = this.taskRegistry.createTask(`Creating container.`, 'loading', labels);

    try {
      const result = await containerEngine.createContainer(engineId, containerCreateOptions);
      // update the task
      containerTask.state = 'success';
      containerTask.progress = undefined;
      // return the ContainerCreateResult
      return {
        id: result.id,
        engineId: engineId,
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

  /**
   * This method allows to pull the image, while creating a task for the user to follow progress
   * @param providerId
   * @param image
   * @param labels
   * @protected
   */
  protected pullImage(
    providerId: string | undefined,
    image: string,
    labels: { [id: string]: string },
  ): Promise<ImageInfo> {
    // Creating a task to follow pulling progress
    const pullingTask = this.taskRegistry.createTask(`Pulling ${image}.`, 'loading', labels);

    // Get the provider
    const provider = getProviderContainerConnection(providerId);

    // get the default image info for this provider
    return getImageInfo(provider.connection, image, (_event: PullEvent) => {})
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
  }
}
