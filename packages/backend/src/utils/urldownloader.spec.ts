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

import { afterEach, beforeEach, expect, test, vi } from 'vitest';
import { createServer, type IncomingMessage, type Server, type ServerResponse } from 'node:http';
import type { AddressInfo } from 'node:net';
import { existsSync, readFileSync } from 'node:fs';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import crypto from 'node:crypto';
import { URLDownloader } from './urldownloader';

// Route the downloader's https.get to a local plain-http server.
vi.mock('node:https', async () => {
  const http = await import('node:http');
  return { default: { get: http.get } };
});

const CONTENT = crypto.randomBytes(512 * 1024);
const SHA256 = crypto.createHash('sha256').update(CONTENT).digest('hex');

type Handler = (req: IncomingMessage, res: ServerResponse, requestIndex: number) => void;

let server: Server | undefined;
let dir: string;
let requests: IncomingMessage[];

class TestDownloader extends URLDownloader {
  protected override stallTimeoutMs = 300;
  protected override retryDelayMs = 0;
  protected override maxAttemptsWithoutProgress = 2;

  public override getRedirect(url: string, location: string): string {
    return super.getRedirect(url, location);
  }
}

async function serve(handler: Handler): Promise<string> {
  requests = [];
  server = createServer((req, res) => {
    requests.push(req);
    handler(req, res, requests.length - 1);
  });
  const listening = server;
  await new Promise<void>(resolve => listening.listen(0, '127.0.0.1', resolve));
  return `http://127.0.0.1:${(listening.address() as AddressInfo).port}/model.gguf`;
}

/** Serves CONTENT, honouring `Range: bytes=N-`. */
function sendContent(req: IncomingMessage, res: ServerResponse): void {
  const start = Number(/bytes=(\d+)-/.exec(req.headers.range ?? '')?.[1] ?? 0);
  if (start > 0) {
    res.writeHead(206, {
      'content-length': CONTENT.length - start,
      'content-range': `bytes ${start}-${CONTENT.length - 1}/${CONTENT.length}`,
    });
  } else {
    res.writeHead(200, { 'content-length': CONTENT.length });
  }
  res.end(CONTENT.subarray(start));
}

/** Sends the headers and half of the body, then calls `then` (reset or hang). */
function sendHalf(res: ServerResponse, then: () => void): void {
  res.writeHead(200, { 'content-length': CONTENT.length });
  res.write(CONTENT.subarray(0, CONTENT.length / 2), then);
}

async function download(
  url: string,
  sha256: string | undefined = SHA256,
): Promise<{ target: string; result: Promise<void> }> {
  const target = join(dir, 'model.gguf');
  const downloader = new TestDownloader(url, target, sha256);
  return { target, result: downloader.perform('model-id') };
}

beforeEach(async () => {
  dir = await mkdtemp(join(tmpdir(), 'urldownloader-'));
  vi.spyOn(console, 'warn').mockImplementation(() => {});
});

afterEach(async () => {
  if (server) {
    server.closeAllConnections();
    await new Promise(resolve => server?.close(resolve));
    server = undefined;
  }
  await rm(dir, { recursive: true, force: true });
});

test('Downloader constructor', () => {
  const downloader = new URLDownloader('dummyUrl', 'dummyTarget');
  expect(downloader.getTarget()).toBe('dummyTarget');
});

test('downloads, verifies the checksum and renames the tmp file', async () => {
  const url = await serve(sendContent);
  const { target, result } = await download(url);

  await result;

  expect(readFileSync(target).equals(CONTENT)).toBeTruthy();
  expect(existsSync(`${target}.tmp`)).toBeFalsy();
  expect(requests).toHaveLength(1);
});

test('emits progress and completed events', async () => {
  const url = await serve(sendContent);
  const downloader = new TestDownloader(url, join(dir, 'model.gguf'), SHA256);
  const listener = vi.fn();
  downloader.onEvent(listener);

  await downloader.perform('model-id');

  expect(listener).toHaveBeenCalledWith(expect.objectContaining({ id: 'model-id', status: 'progress', value: 100 }));
  expect(listener).toHaveBeenLastCalledWith(expect.objectContaining({ id: 'model-id', status: 'completed' }));
});

test('resumes with a Range request when the connection is reset mid-download', async () => {
  const url = await serve((req, res, i) =>
    i === 0 ? sendHalf(res, () => res.socket?.destroy()) : sendContent(req, res),
  );
  const { target, result } = await download(url);

  await result;

  expect(readFileSync(target).equals(CONTENT)).toBeTruthy();
  expect(requests).toHaveLength(2);
  expect(requests[1].headers.range).toMatch(/^bytes=[1-9]\d*-$/);
});

test('resumes when the connection stalls without being closed', async () => {
  const url = await serve((req, res, i) => (i === 0 ? sendHalf(res, () => {}) : sendContent(req, res)));
  const { target, result } = await download(url);

  await result;

  expect(readFileSync(target).equals(CONTENT)).toBeTruthy();
  expect(requests[1].headers.range).toMatch(/^bytes=[1-9]\d*-$/);
});

test('restarts from scratch when the server ignores the Range header', async () => {
  const url = await serve((_req, res, i) => {
    if (i === 0) {
      sendHalf(res, () => res.socket?.destroy());
    } else {
      res.writeHead(200, { 'content-length': CONTENT.length });
      res.end(CONTENT);
    }
  });
  const { target, result } = await download(url);

  await result;

  expect(readFileSync(target).equals(CONTENT)).toBeTruthy();
});

test('follows redirects on every attempt', async () => {
  const url = await serve((req, res, i) => {
    if (req.url === '/model.gguf') {
      res.writeHead(302, { location: '/cdn/model.gguf' });
      res.end();
    } else if (i === 1) {
      sendHalf(res, () => res.socket?.destroy());
    } else {
      sendContent(req, res);
    }
  });
  const { target, result } = await download(url);

  await result;

  expect(readFileSync(target).equals(CONTENT)).toBeTruthy();
  expect(requests.map(r => r.url)).toEqual(['/model.gguf', '/cdn/model.gguf', '/model.gguf', '/cdn/model.gguf']);
});

test('gives up after consecutive attempts without progress and removes the tmp file', async () => {
  const url = await serve(req => req.socket.destroy());
  const { target, result } = await download(url);

  await expect(result).rejects.toThrow();

  expect(requests).toHaveLength(2);
  expect(existsSync(`${target}.tmp`)).toBeFalsy();
});

test('fails without retrying on a client error status', async () => {
  const url = await serve((_req, res) => {
    res.writeHead(404);
    res.end();
  });
  const { result } = await download(url);

  await expect(result).rejects.toThrow('HTTP 404');
  expect(requests).toHaveLength(1);
});

test('fails without retrying on checksum mismatch', async () => {
  const url = await serve(sendContent);
  const { target, result } = await download(url, 'not-the-right-sha');

  await expect(result).rejects.toThrow('SHA-256');
  expect(requests).toHaveLength(1);
  expect(existsSync(target)).toBeFalsy();
  expect(existsSync(`${target}.tmp`)).toBeFalsy();
});

const SITE_EXAMPLE = 'https://example.com/hello';
const SITE_DUMMY = 'https://dummy.com/world';

test('redirect should use location if parsable', () => {
  const downloader = new TestDownloader(SITE_EXAMPLE, '/home/file.guff');
  expect(downloader.getRedirect(SITE_EXAMPLE, SITE_DUMMY)).toBe(SITE_DUMMY);
});

test('redirect should concat base url and location if not parsable', () => {
  const downloader = new TestDownloader(SITE_EXAMPLE, '/home/file.guff');
  expect(downloader.getRedirect(SITE_EXAMPLE, '/world')).toBe('https://example.com/world');
});
