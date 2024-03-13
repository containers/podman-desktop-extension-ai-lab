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

  async perform(id: string): Promise<string> {
    const workers = this.#workers.filter(w => w.canUpload());
    let modelPath = this.localModelPath;
    try {
      if (workers && workers.length > 1) {
        throw new Error('too many uploaders registered for this system');
      }
      const worker = workers?.[0];
      if (worker) {
        const startTime = performance.now();
        modelPath = await worker.upload(this.localModelPath);
        const durationSeconds = getDurationSecondsSince(startTime);
        this.#_onEvent.fire({
          id,
          status: 'completed',
          message: `Duration ${durationSeconds}s.`,
          duration: durationSeconds,
        } as CompletionEvent);
        return modelPath;
      }
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

    this.#_onEvent.fire({
      id,
      status: 'completed',
      message: `Use local model`,
    } as CompletionEvent);

    return modelPath;
  }
}
