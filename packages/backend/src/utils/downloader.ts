import { getDurationSecondsSince } from './utils';
import fs from 'fs';
import https from 'node:https';
import { EventEmitter, type Event } from '@podman-desktop/api';

export interface DownloadEvent {
  status: 'error' | 'completed' | 'progress' | 'canceled',
  message?: string
}

export interface CompletionEvent extends DownloadEvent {
  status: 'completed' | 'error' | 'canceled',
  duration: number,
}

export interface ProgressEvent extends DownloadEvent {
  status: 'progress',
  value: number,
}

export const isCompletionEvent = (value: unknown): value is CompletionEvent => {
  return !!value && typeof value === 'object' && 'status' in value && typeof value['status'] === 'string' && ['canceled', 'completed', 'error'].includes(value['status']) && 'duration' in value;
};

export const isProgressEvent = (value: unknown): value is ProgressEvent => {
  return !!value && typeof value === 'object' && 'status' in value && value['status'] === 'progress' && 'value' in value;
};

export class Downloader {
  private readonly _onEvent = new EventEmitter<DownloadEvent>();
  readonly onEvent: Event<DownloadEvent> = this._onEvent.event;

  constructor(private url: string, private target: string, private abortSignal?: AbortSignal) {}

  async perform() {
    const startTime = performance.now();

    try {
      await this.download(this.url);
      const durationSeconds = getDurationSecondsSince(startTime);
      this._onEvent.fire({
        status: 'completed',
        message: `Duration ${durationSeconds}s.`,
        duration: durationSeconds,
      } as CompletionEvent);
    } catch (err: unknown) {
      if(!this.abortSignal?.aborted) {
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

  private download(
    url: string,
  ): Promise<void> {
    return new Promise((resolve, reject) => {
      const callback = (result: {ok: boolean, error?: string}) => {
        if (result.ok) {
          resolve();
        } else {
          reject(result.error);
        }
      };
      this.followRedirects(url, callback);
    });
  }

  private followRedirects(
    url: string,
    callback: (message: {ok?: boolean, error?: string}) => void,
  ) {
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
          } as ProgressEvent);
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
