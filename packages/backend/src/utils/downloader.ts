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

export interface DownloadEvent {
  id: string;
  status: 'error' | 'completed' | 'progress' | 'canceled';
  message?: string;
}

export interface CompletionEvent extends DownloadEvent {
  status: 'completed' | 'error' | 'canceled';
  duration: number;
}

export interface ProgressEvent extends DownloadEvent {
  status: 'progress';
  value: number;
}

export const isCompletionEvent = (value: unknown): value is CompletionEvent => {
  return (
    !!value &&
    typeof value === 'object' &&
    'status' in value &&
    typeof value['status'] === 'string' &&
    ['canceled', 'completed', 'error'].includes(value['status']) &&
    'duration' in value
  );
};

export const isProgressEvent = (value: unknown): value is ProgressEvent => {
  return (
    !!value && typeof value === 'object' && 'status' in value && value['status'] === 'progress' && 'value' in value
  );
};

export class Downloader {
  private readonly _onEvent = new EventEmitter<DownloadEvent>();
  readonly onEvent: Event<DownloadEvent> = this._onEvent.event;
  private requestedIdentifier: string;

  completed: boolean;

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
    const tmpFile = `${this.target}.tmp`;
    const stream = createWriteStream(tmpFile);

    stream.on('finish', () => {
      stream.close();
      // Rename from tmp to expected file name.
      promises
        .rename(tmpFile, this.target)
        .then(() => {
          callback({ ok: true });
        })
        .catch((err: unknown) => {
          callback({ error: `Something went wrong while trying to rename downloaded file: ${String(err)}.` });
        });
    });
    stream.on('error', e => {
      callback({
        error: e.message,
      });
    });

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
            id: this.requestedIdentifier,
            status: 'progress',
            value: progressValue,
          } as ProgressEvent);
        }
      });
      resp.pipe(stream);
    });
  }
}
