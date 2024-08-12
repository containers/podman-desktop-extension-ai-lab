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
  ContainerProviderConnection,
  Disposable,
  ImageInfo,
  PullEvent,
} from '@podman-desktop/api';
import { containerEngine } from '@podman-desktop/api';
import type { InferenceServerConfig } from '@shared/src/models/InferenceServerConfig';
import type { IWorker } from '../IWorker';
import type { TaskRegistry } from '../../registries/TaskRegistry';
import { getImageInfo } from '../../utils/inferenceUtils';
import type { InferenceServer, InferenceType } from '@shared/src/models/IInference';

export type BetterContainerCreateResult = ContainerCreateResult & { engineId: string };

export abstract class InferenceProvider implements IWorker<InferenceServerConfig, InferenceServer>, Disposable {
  readonly type: InferenceType;
  readonly name: string;

  protected constructor(
    private taskRegistry: TaskRegistry,
    type: InferenceType,
    name: string,
  ) {
    this.type = type;
    this.name = name;
  }

  abstract enabled(): boolean;
  abstract perform(config: InferenceServerConfig): Promise<InferenceServer>;
  abstract dispose(): void;

  protected async createContainer(
    engineId: string,
    containerCreateOptions: ContainerCreateOptions,
    labels: { [id: string]: string },
  ): Promise<BetterContainerCreateResult> {
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
   * @param connection
   * @param image
   * @param labels
   * @protected
   */
  protected pullImage(
    connection: ContainerProviderConnection,
    image: string,
    labels: { [id: string]: string },
  ): Promise<ImageInfo> {
    // Creating a task to follow pulling progress
    const pullingTask = this.taskRegistry.createTask(`Pulling ${image}.`, 'loading', labels);

    // get the default image info for this provider
    return getImageInfo(connection, image, (_event: PullEvent) => {})
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
