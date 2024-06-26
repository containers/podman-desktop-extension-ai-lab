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
import type { Disposable, Event } from '@podman-desktop/api';
import { EventEmitter } from '@podman-desktop/api';
import { type InferenceServerInfo, RuntimeType } from '@shared/src/models/IInference';
import type { InferenceServerConfig } from '@shared/src/models/InferenceServerConfig';
import { getRandomString } from '../../utils/randomUtils';
import type { TaskRegistry } from '../../registries/TaskRegistry';

export interface InferenceServerInstance extends InferenceServerInfo {
  id: string;
  runtime: RuntimeType;

  // utility methods
  stop: () => Promise<void>;
  start: () => Promise<void>;
  remove: () => Promise<void>;
}

export abstract class RuntimeEngine implements Disposable {
  id: string;
  runtime: RuntimeType;

  protected readonly _onUpdate = new EventEmitter<InferenceServerInstance[]>();
  readonly onUpdate: Event<InferenceServerInstance[]> = this._onUpdate.event;

  protected constructor(
    id: string,
    runtime: RuntimeType,
    protected taskRegistry: TaskRegistry,
  ) {
    this.id = id;
    this.runtime = runtime;
  }

  protected notify(): void {
    this._onUpdate.fire(this.getServers());
  }

  abstract init(): void;
  abstract dispose(): void;

  abstract getServers(): InferenceServerInstance[];

  /**
   * Creating an inference server can be heavy task (pulling image, uploading model to WSL etc.)
   * The frontend cannot wait endlessly, therefore we provide a method returning a tracking identifier
   * that can be used to fetch the tasks
   *
   * @param config the config to use to create the inference server
   *
   * @return a unique tracking identifier to follow the creation request
   */
  requestCreate(config: InferenceServerConfig): string {
    const trackingId: string = getRandomString();

    config.labels = {
      ...config.labels,
      trackingId: trackingId,
    };

    const task = this.taskRegistry.createTask('Creating Inference server', 'loading', {
      trackingId: trackingId,
    });

    this.create(config)
      .then(server => {
        this.taskRegistry.updateTask({
          ...task,
          state: 'success',
          labels: {
            ...task.labels,
            containerId: server.container.containerId,
          },
        });
      })
      .catch((err: unknown) => {
        // print the error
        console.error(err);

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
      });

    return trackingId;
  }
  abstract create(config: InferenceServerConfig): Promise<InferenceServerInstance>;
}
