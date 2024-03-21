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

import { EventEmitter, type Event } from '@podman-desktop/api';
import { WSLUploader } from './WSLUploader';
import { getDurationSecondsSince } from './utils';
import type { CompletionEvent, BaseEvent } from '../models/baseEvent';

export interface UploadWorker {
  canUpload: () => boolean;
  upload: (path: string) => Promise<string>;
}

export class Uploader {
  readonly #_onEvent = new EventEmitter<BaseEvent>();
  readonly onEvent: Event<BaseEvent> = this.#_onEvent.event;
  readonly #workers: UploadWorker[] = [];

  constructor(
    private localModelPath: string,
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
    const worker: UploadWorker | undefined = this.#workers.find(w => w.canUpload());

    // If none are found, we return the current path
    if(worker === undefined) {
      console.warn('There is no workers compatible. Using default local mounting');
      this.#_onEvent.fire({
        id,
        status: 'completed',
        message: `Use local model`,
      } as CompletionEvent);

      return this.localModelPath;
    }

    try {
      // measure performance
      const startTime = performance.now();
      // get new path
      const modelPath = await worker.upload(this.localModelPath);
      // compute full time
      const durationSeconds = getDurationSecondsSince(startTime);
      // fire events
      this.#_onEvent.fire({
        id,
        status: 'completed',
        message: `Duration ${durationSeconds}s.`,
        duration: durationSeconds,
      } as CompletionEvent);

      // return the new path on the podman machine
      return modelPath;
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
