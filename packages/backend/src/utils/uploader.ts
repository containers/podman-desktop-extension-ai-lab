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

import { EventEmitter, type Event, type ContainerProviderConnection } from '@podman-desktop/api';
import { WSLUploader } from '../workers/uploader/WSLUploader';
import { getDurationSecondsSince } from './utils';
import type { CompletionEvent, BaseEvent } from '../models/baseEvent';
import type { ModelInfo } from '@shared/src/models/IModelInfo';
import { getLocalModelFile } from './modelsUtils';
import type { IWorker } from '../workers/IWorker';
import type { UploaderOptions } from '../workers/uploader/UploaderOptions';

export class Uploader {
  readonly #_onEvent = new EventEmitter<BaseEvent>();
  readonly onEvent: Event<BaseEvent> = this.#_onEvent.event;
  readonly #workers: IWorker<UploaderOptions, string>[] = [];

  constructor(
    private connection: ContainerProviderConnection,
    private modelInfo: ModelInfo,
    private abortSignal?: AbortSignal,
  ) {
    this.#workers = [new WSLUploader()];
  }

  /**
   * Performing the upload action
   * @param id tracking id
   *
   * @return the path to model after the operation (either on the podman machine or local if not compatible)
   */
  async perform(id: string): Promise<string> {
    // Find the uploader for the current operating system
    const worker: IWorker<UploaderOptions, string> | undefined = this.#workers.find(w => w.enabled());

    // If none are found, we return the current path
    if (worker === undefined) {
      console.warn('There is no workers compatible. Using default local mounting');
      this.#_onEvent.fire({
        id,
        status: 'completed',
        message: `Use local model`,
      } as CompletionEvent);

      return getLocalModelFile(this.modelInfo);
    }

    try {
      // measure performance
      const startTime = performance.now();
      console.log(`Uploading model to podman machine started at ${startTime}`);
      // get new path
      const remotePath = await worker.perform({
        connection: this.connection,
        model: this.modelInfo,
      });
      // compute full time
      const durationSeconds = getDurationSecondsSince(startTime);
      // fire events
      this.#_onEvent.fire({
        id,
        status: 'completed',
        message: `Duration ${durationSeconds}s.`,
        duration: durationSeconds,
      } as CompletionEvent);

      console.log(`Completed in ${durationSeconds} seconds!`);
      // return the new path on the podman machine
      return remotePath;
    } catch (err) {
      if (!this.abortSignal?.aborted) {
        this.#_onEvent.fire({
          id,
          status: 'error',
          message: `Something went wrong: ${String(err)}.`,
        });
      } else {
        this.#_onEvent.fire({
          id,
          status: 'canceled',
          message: `Request cancelled: ${String(err)}.`,
        });
      }
      throw new Error(`Unable to upload model. Error: ${String(err)}`);
    }
  }
}
