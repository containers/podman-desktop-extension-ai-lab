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
import { createReadStream, createWriteStream, existsSync } from 'node:fs';
import { mkdir, rename, rm, stat } from 'node:fs/promises';
import { dirname } from 'node:path';
import crypto from 'node:crypto';
import https from 'node:https';
import type { IncomingMessage } from 'node:http';
import { pipeline } from 'node:stream/promises';
import { setTimeout } from 'node:timers/promises';
import type { CompletionEvent, ProgressEvent } from '../models/baseEvent';
import { Downloader } from './downloader';

const MAX_REDIRECTS = 10;

/** Errors that retrying cannot fix (bad checksum, 404, ...). */
class FatalDownloadError extends Error {}

export class URLDownloader extends Downloader {
  private requestedIdentifier: string | undefined;

  /** A connection that delivers no data for this long is treated as stalled and resumed on a new one. */
  protected stallTimeoutMs = 30_000;
  /** Give up after this many consecutive attempts that did not add a single byte. */
  protected maxAttemptsWithoutProgress = 5;
  protected retryDelayMs = 2_000;

  constructor(
    url: string,
    target: string,
    private sha256?: string,
    private abortSignal?: AbortSignal,
  ) {
    super(url, target);
  }

  async perform(id: string): Promise<void> {
    //ensure parent folder exists
    if (!existsSync(dirname(this.target))) {
      await mkdir(dirname(this.target), { recursive: true });
    }
    this.requestedIdentifier = id;
    const startTime = performance.now();

    try {
      await this.download();
      const durationSeconds = getDurationSecondsSince(startTime);
      this._onEvent.fire({
        id: this.requestedIdentifier,
        status: 'completed',
        message: `Duration ${durationSeconds}s.`,
        duration: durationSeconds,
      } as CompletionEvent);
    } catch (err: unknown) {
      const reason = err instanceof Error ? err.message : String(err);
      if (!this.abortSignal?.aborted) {
        this._onEvent.fire({
          id: this.requestedIdentifier,
          status: 'error',
          message: `Something went wrong: ${reason}.`,
        });
      } else {
        this._onEvent.fire({
          id: this.requestedIdentifier,
          status: 'canceled',
          message: `Request cancelled: ${reason}.`,
        });
      }
      throw err;
    } finally {
      this.completed = true;
    }
  }

  /**
   * This file takes as argument a location, either a full url or a path
   * if a path is provided, the url will be used as origin.
   * @param url
   * @param location
   * @protected
   */
  protected getRedirect(url: string, location: string): string {
    if (URL.canParse(location)) return location;

    const origin = new URL(url).origin;
    if (URL.canParse(location, origin)) return new URL(location, origin).href;

    return location;
  }

  private async download(): Promise<void> {
    const tmpFile = `${this.target}.tmp`;
    try {
      await this.downloadWithResume(tmpFile);
      await this.verifyChecksum(tmpFile);
      await rename(tmpFile, this.target);
    } catch (err: unknown) {
      await rm(tmpFile, { force: true }).catch((rmErr: unknown) => {
        console.error(`Something went wrong while trying to delete ${tmpFile}`, rmErr);
      });
      throw err;
    }
  }

  /**
   * Large files over a single connection regularly get reset or stall mid-way (CDN / network idle timeouts).
   * Instead of starting over, reconnect and continue from the bytes already on disk using an HTTP Range request.
   */
  private async downloadWithResume(tmpFile: string): Promise<void> {
    let attemptsWithoutProgress = 0;
    let offset = 0;
    for (;;) {
      try {
        await this.downloadFrom(tmpFile, offset);
        return;
      } catch (err: unknown) {
        if (this.abortSignal?.aborted || err instanceof FatalDownloadError) throw err;

        const onDisk = await fileSize(tmpFile);
        attemptsWithoutProgress = onDisk > offset ? 0 : attemptsWithoutProgress + 1;
        if (attemptsWithoutProgress >= this.maxAttemptsWithoutProgress) throw err;

        console.warn(`Download of ${this.url} interrupted at ${onDisk} bytes (${String(err)}), resuming`);
        offset = onDisk;
        await setTimeout(this.retryDelayMs, undefined, { signal: this.abortSignal });
      }
    }
  }

  private async downloadFrom(tmpFile: string, offset: number): Promise<void> {
    const resp = await this.get(this.url, offset, MAX_REDIRECTS);
    if (resp.statusCode === 416) {
      // Range not satisfiable: we already have the whole file (the checksum check guards the result).
      resp.resume();
      return;
    }

    // 206 = server honoured the Range, anything else = it sent the whole file again.
    const start = resp.statusCode === 206 ? offset : 0;
    const contentLength = Number(resp.headers['content-length'] ?? 0);
    const total = contentLength > 0 ? start + contentLength : 0;

    let received = start;
    let previousProgressValue = -1;
    resp.on('data', (chunk: Buffer) => {
      received += chunk.length;
      if (!total) return;
      const progressValue = (received * 100) / total;
      // Only fire events for progress greater than 1
      if (progressValue === 100 || progressValue - previousProgressValue > 1) {
        previousProgressValue = progressValue;
        this._onEvent.fire({
          id: this.requestedIdentifier,
          status: 'progress',
          value: progressValue,
          total,
        } as ProgressEvent);
      }
    });

    await pipeline(resp, createWriteStream(tmpFile, { flags: start > 0 ? 'a' : 'w' }), { signal: this.abortSignal });

    if (total && (await fileSize(tmpFile)) < total) {
      throw new Error('connection closed before the download completed');
    }
  }

  /** GET following redirects. Resolves with a 2xx (or 416) response, rejects otherwise. */
  private get(url: string, offset: number, redirectsLeft: number): Promise<IncomingMessage> {
    return new Promise((resolve, reject) => {
      const headers = offset > 0 ? { Range: `bytes=${offset}-` } : undefined;
      const req = https.get(url, { signal: this.abortSignal, headers, timeout: this.stallTimeoutMs }, resp => {
        const status = resp.statusCode ?? 0;
        if (resp.headers.location) {
          resp.resume();
          if (redirectsLeft <= 0) {
            reject(new FatalDownloadError(`Too many redirects while downloading ${this.url}`));
            return;
          }
          this.get(this.getRedirect(url, resp.headers.location), offset, redirectsLeft - 1).then(resolve, reject);
          return;
        }
        if ((status >= 200 && status < 300) || status === 416) {
          resolve(resp);
          return;
        }
        resp.resume();
        const message = `HTTP ${status} while downloading ${this.url}`;
        const retryable = status >= 500 || status === 408 || status === 429;
        reject(retryable ? new Error(message) : new FatalDownloadError(message));
      });
      req.on('timeout', () => req.destroy(new Error(`no data received for ${this.stallTimeoutMs / 1000}s`)));
      req.on('error', reject);
    });
  }

  private async verifyChecksum(file: string): Promise<void> {
    if (!this.sha256) return;
    const hash = crypto.createHash('sha256');
    for await (const chunk of createReadStream(file)) {
      hash.update(chunk as Buffer);
    }
    if (hash.digest('hex') !== this.sha256) {
      throw new FatalDownloadError(
        `The file's security hash (SHA-256) does not match the expected value. The file may have been altered or corrupted during the download process`,
      );
    }
  }
}

async function fileSize(file: string): Promise<number> {
  try {
    return (await stat(file)).size;
  } catch {
    return 0;
  }
}
