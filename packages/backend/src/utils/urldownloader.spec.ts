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

import { vi, test, expect, beforeEach } from 'vitest';
import { EventEmitter } from '@podman-desktop/api';
import { createWriteStream, existsSync, type WriteStream } from 'node:fs';
import { rename, rm } from 'node:fs/promises';
import https, { type RequestOptions } from 'node:https';
import type { ClientRequest, IncomingMessage } from 'node:http';
import { URLDownloader } from './urldownloader';

vi.mock('@podman-desktop/api', () => {
  return {
    EventEmitter: vi.fn(),
  };
});

vi.mock('node:https', () => {
  return {
    default: {
      get: vi.fn(),
    },
  };
});

vi.mock('node:fs', () => {
  return {
    createWriteStream: vi.fn(),
    existsSync: vi.fn(),
  };
});

vi.mock('node:fs/promises', () => {
  return {
    rename: vi.fn(),
    rm: vi.fn(),
  };
});

beforeEach(() => {
  vi.resetAllMocks();

  const listeners: ((value: unknown) => void)[] = [];

  vi.mocked(EventEmitter).mockReturnValue({
    event: vi.fn().mockImplementation(callback => {
      listeners.push(callback);
    }),
    fire: vi.fn().mockImplementation((content: unknown) => {
      listeners.forEach(listener => listener(content));
    }),
  } as unknown as EventEmitter<unknown>);

  vi.mocked(rm).mockResolvedValue(undefined);
  vi.mocked(rename).mockResolvedValue(undefined);
});

test('Downloader constructor', async () => {
  const downloader = new URLDownloader('dummyUrl', 'dummyTarget');
  expect(downloader.getTarget()).toBe('dummyTarget');
});

test('perform download failed', async () => {
  const downloader = new URLDownloader('dummyUrl', 'dummyTarget');

  let onResponse: ((msg: IncomingMessage) => void) | undefined;
  vi.mocked(
    https.get as (url: string | URL, options: RequestOptions, callback: (_: IncomingMessage) => void) => ClientRequest,
  ).mockImplementation((_url, _options, callback) => {
    onResponse = callback;
    return {} as unknown as ClientRequest;
  });

  const closeMock = vi.fn();
  const onMock = vi.fn();
  vi.mocked(createWriteStream).mockReturnValue({
    close: closeMock,
    on: onMock,
  } as unknown as WriteStream);
  vi.mocked(existsSync).mockReturnValue(true);

  onMock.mockImplementation((event: string, callback: (err: Error) => void) => {
    if (event === 'error') {
      callback(new Error('dummyError'));
    }
  });
  // capture downloader event(s)
  const listenerMock = vi.fn();
  downloader.onEvent(listenerMock);

  const rejectSpy = vi.fn();

  // perform download logic (do not wait)
  downloader.perform('followUpId').catch((e: unknown) => rejectSpy(e));

  // wait for listener to be registered
  await vi.waitFor(() => {
    expect(onResponse).toBeDefined();
  });

  if (onResponse === undefined) throw new Error('onResponse undefined');

  onResponse({
    pipe: vi.fn(),
    on: vi.fn(),
    headers: { location: undefined },
  } as unknown as IncomingMessage);

  await vi.waitFor(() => {
    expect(downloader.completed).toBeTruthy();
  });

  expect(listenerMock).toHaveBeenCalledWith({
    id: 'followUpId',
    message: 'Something went wrong: dummyError.',
    status: 'error',
  });
  expect(rm).toHaveBeenCalledWith('dummyTarget.tmp');

  expect(rejectSpy).toHaveBeenCalledWith('dummyError');
});

test('perform download successfully', async () => {
  const downloader = new URLDownloader('dummyUrl', 'dummyTarget');
  let onResponse: ((msg: IncomingMessage) => void) | undefined;
  vi.mocked(
    https.get as (url: string | URL, options: RequestOptions, callback: (_: IncomingMessage) => void) => ClientRequest,
  ).mockImplementation((_url, _options, callback) => {
    onResponse = callback;
    return {} as unknown as ClientRequest;
  });

  const closeMock = vi.fn();
  const onMock = vi.fn();
  vi.mocked(createWriteStream).mockReturnValue({
    close: closeMock,
    on: onMock,
  } as unknown as WriteStream);
  vi.mocked(existsSync).mockReturnValue(true);

  onMock.mockImplementation((event: string, callback: () => void) => {
    if (event === 'finish') {
      callback();
    }
  });

  // capture downloader event(s)
  const listenerMock = vi.fn();
  downloader.onEvent(listenerMock);

  // perform download logic
  downloader.perform('followUpId').catch((err: unknown) => console.error(err));

  // wait for listener to be registered
  await vi.waitFor(() => {
    expect(onResponse).toBeDefined();
  });

  if (onResponse === undefined) throw new Error('onResponse undefined');

  onResponse({
    pipe: vi.fn(),
    on: vi.fn(),
    headers: { location: undefined },
  } as unknown as IncomingMessage);

  await vi.waitFor(() => {
    expect(downloader.completed).toBeTruthy();
  });

  expect(rename).toHaveBeenCalledWith('dummyTarget.tmp', 'dummyTarget');
  expect(downloader.completed).toBeTruthy();
  expect(listenerMock).toHaveBeenCalledWith({
    id: 'followUpId',
    duration: expect.anything(),
    message: expect.anything(),
    status: 'completed',
  });
  expect(rm).not.toHaveBeenCalled();
});

class DownloaderTest extends URLDownloader {
  public override getRedirect(url: string, location: string): string {
    return super.getRedirect(url, location);
  }
}

const SITE_EXAMPLE = 'https://example.com/hello';
const SITE_DUMMY = 'https://dummy.com/world';

test('redirect should use location if parsable', () => {
  const downloader = new DownloaderTest(SITE_EXAMPLE, '/home/file.guff');
  const result = downloader.getRedirect(SITE_EXAMPLE, SITE_DUMMY);
  expect(result).toBe(SITE_DUMMY);
});

test('redirect should concat base url and location if not parsable', () => {
  const downloader = new DownloaderTest(SITE_EXAMPLE, '/home/file.guff');
  const result = downloader.getRedirect(SITE_EXAMPLE, '/world');
  expect(result).toBe('https://example.com/world');
});
