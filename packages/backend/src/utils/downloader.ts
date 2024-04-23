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

import { getDurationSecondsSince } from './utils';
import { createWriteStream, promises } from 'node:fs';
import https from 'node:https';
import { EventEmitter, type Event } from '@podman-desktop/api';
import type { CompletionEvent, ProgressEvent, BaseEvent } from '../models/baseEvent';

export class Downloader {
  private readonly _onEvent = new EventEmitter<BaseEvent>();
  readonly onEvent: Event<BaseEvent> = this._onEvent.event;
  private requestedIdentifier: string | undefined;

  completed: boolean = false;

  constructor(
    private url: string,
    private target: string,
    private abortSignal?: AbortSignal,
  ) {}

  getTarget(): string {
    return this.target;
  }

  async perform(id: string) {
    this.requestedIdentifier = id;
    const startTime = performance.now();

    try {
      await this.download(this.url);
      const durationSeconds = getDurationSecondsSince(startTime);
      this._onEvent.fire({
        id: this.requestedIdentifier,
        status: 'completed',
        message: `Duration ${durationSeconds}s.`,
        duration: durationSeconds,
      } as CompletionEvent);
    } catch (err: unknown) {
      if (!this.abortSignal?.aborted) {
        this._onEvent.fire({
          id: this.requestedIdentifier,
          status: 'error',
          message: `Something went wrong: ${String(err)}.`,
        });
      } else {
        this._onEvent.fire({
          id: this.requestedIdentifier,
          status: 'canceled',
          message: `Request cancelled: ${String(err)}.`,
        });
      }
    } finally {
      this.completed = true;
    }
  }

  private download(url: string): Promise<void> {
    return new Promise((resolve, reject) => {
      const callback = (result: { ok?: boolean; error?: string }) => {
        if (result.ok) {
          resolve();
        } else {
          reject(result.error);
        }
      };
      this.followRedirects(url, callback);
    });
  }

  private followRedirects(url: string, callback: (message: { ok?: boolean; error?: string }) => void): void {
    const tmpFile = `${this.target}.tmp`;

    let totalFileSize = 0;
    let progress = 0;
    let previousProgressValue = -1;

    https.get(url, { signal: this.abortSignal }, resp => {
      // Determine the total size
      if (resp.headers.location) {
        this.followRedirects(resp.headers.location, callback);
        return;
      }

      if (totalFileSize === 0 && resp.headers['content-length']) {
        totalFileSize = parseFloat(resp.headers['content-length']);
      }

      const stream = createWriteStream(tmpFile, {
        signal: this.abortSignal,
      });

      // Capture potential errors
      resp.on('error', (err: Error) => {
        stream.destroy(err); // propagate to stream
      });

      // On data
      resp.on('data', chunk => {
        progress += chunk.length;
        const progressValue = (progress * 100) / totalFileSize;

        // Only fire events for progress greater than 1
        if (progressValue === 100 || progressValue - previousProgressValue > 1) {
          previousProgressValue = progressValue;
          this._onEvent.fire({
            id: this.requestedIdentifier,
            status: 'progress',
            value: progressValue,
          } as ProgressEvent);
        }
      });
      // Pipe to stream
      resp.pipe(stream);

      // Handle error case
      stream.on('error', (err: Error) => {
        promises
          .rm(tmpFile)
          .then(() => {
            callback({
              error: err.message,
            });
          })
          .catch((err: unknown) => {
            console.error(`Something went wrong while trying to delete ${tmpFile}`, err);
          });
      });

      // On close event
      stream.on('finish', () => {
        // check if _parent_ is errored
        if (resp.errored) {
          return;
        }

        // If everything is fine we simply rename the tmp file to the expected one
        promises
          .rename(tmpFile, this.target)
          .then(() => {
            callback({ ok: true });
          })
          .catch((err: unknown) => {
            callback({ error: `Something went wrong while trying to rename downloaded file: ${String(err)}.` });
          });
      });
    });
  }
}
