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
import fs from 'fs';
import https from 'node:https';
import { EventEmitter, type Event } from '@podman-desktop/api';
import type { CompletionProgressiveEvent, ProgressProgressiveEvent, ProgressiveEvent } from './progressiveEvent';

export class Downloader {
  private readonly _onEvent = new EventEmitter<ProgressiveEvent>();
  readonly onEvent: Event<ProgressiveEvent> = this._onEvent.event;

  constructor(
    private url: string,
    private target: string,
    private abortSignal?: AbortSignal,
  ) {}

  async perform() {
    const startTime = performance.now();

    try {
      await this.download(this.url);
      const durationSeconds = getDurationSecondsSince(startTime);
      this._onEvent.fire({
        status: 'completed',
        message: `Duration ${durationSeconds}s.`,
        duration: durationSeconds,
      } as CompletionProgressiveEvent);
    } catch (err: unknown) {
      if (!this.abortSignal?.aborted) {
        this._onEvent.fire({
          status: 'error',
          message: `Something went wrong: ${String(err)}.`,
        });
      } else {
        this._onEvent.fire({
          status: 'canceled',
          message: `Request cancelled: ${String(err)}.`,
        });
      }
    }
  }

  private download(url: string): Promise<void> {
    return new Promise((resolve, reject) => {
      const callback = (result: { ok: boolean; error?: string }) => {
        if (result.ok) {
          resolve();
        } else {
          reject(result.error);
        }
      };
      this.followRedirects(url, callback);
    });
  }

  private followRedirects(url: string, callback: (message: { ok?: boolean; error?: string }) => void) {
    const file = fs.createWriteStream(this.target);
    let totalFileSize = 0;
    let progress = 0;
    https.get(url, { signal: this.abortSignal }, resp => {
      if (resp.headers.location) {
        this.followRedirects(resp.headers.location, callback);
        return;
      } else {
        if (totalFileSize === 0 && resp.headers['content-length']) {
          totalFileSize = parseFloat(resp.headers['content-length']);
        }
      }

      let previousProgressValue = -1;
      resp.on('data', chunk => {
        progress += chunk.length;
        const progressValue = (progress * 100) / totalFileSize;

        if (progressValue === 100 || progressValue - previousProgressValue > 1) {
          previousProgressValue = progressValue;
          this._onEvent.fire({
            status: 'progress',
            value: progressValue,
          } as ProgressProgressiveEvent);
        }

        // send progress in percentage (ex. 1.2%, 2.6%, 80.1%) to frontend
        if (progressValue === 100) {
          callback({ ok: true });
        }
      });
      file.on('finish', () => {
        file.close();
      });
      file.on('error', e => {
        callback({
          error: e.message,
        });
      });
      resp.pipe(file);
    });
  }
}
