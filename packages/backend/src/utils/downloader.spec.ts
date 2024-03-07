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
import { Downloader } from './downloader';
import { EventEmitter } from '@podman-desktop/api';
import { createWriteStream, promises, type WriteStream } from 'node:fs';

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
    promises: {
      rename: vi.fn(),
    },
  };
});

beforeEach(() => {
  const listeners: ((value: unknown) => void)[] = [];

  vi.mocked(EventEmitter).mockReturnValue({
    event: vi.fn().mockImplementation(callback => {
      listeners.push(callback);
    }),
    fire: vi.fn().mockImplementation((content: unknown) => {
      listeners.forEach(listener => listener(content));
    }),
  } as unknown as EventEmitter<unknown>);
});

test('Downloader constructor', async () => {
  const downloader = new Downloader('dummyUrl', 'dummyTarget');
  expect(downloader.getTarget()).toBe('dummyTarget');
});

test('perform download failed', async () => {
  const downloader = new Downloader('dummyUrl', 'dummyTarget');

  const closeMock = vi.fn();
  const onMock = vi.fn();
  vi.mocked(createWriteStream).mockReturnValue({
    close: closeMock,
    on: onMock,
  } as unknown as WriteStream);

  onMock.mockImplementation((event: string, callback: () => void) => {
    if (event === 'error') {
      callback();
    }
  });
  // capture downloader event(s)
  const listenerMock = vi.fn();
  downloader.onEvent(listenerMock);

  // perform download logic
  await downloader.perform('followUpId');

  expect(downloader.completed).toBeTruthy();
  expect(listenerMock).toHaveBeenCalledWith({
    id: 'followUpId',
    message: expect.anything(),
    status: 'error',
  });
});

test('perform download successfully', async () => {
  const downloader = new Downloader('dummyUrl', 'dummyTarget');
  vi.spyOn(promises, 'rename').mockResolvedValue(undefined);

  const closeMock = vi.fn();
  const onMock = vi.fn();
  vi.mocked(createWriteStream).mockReturnValue({
    close: closeMock,
    on: onMock,
  } as unknown as WriteStream);

  onMock.mockImplementation((event: string, callback: () => void) => {
    if (event === 'finish') {
      callback();
    }
  });

  // capture downloader event(s)
  const listenerMock = vi.fn();
  downloader.onEvent(listenerMock);

  // perform download logic
  await downloader.perform('followUpId');

  expect(promises.rename).toHaveBeenCalledWith('dummyTarget.tmp', 'dummyTarget');
  expect(downloader.completed).toBeTruthy();
  expect(listenerMock).toHaveBeenCalledWith({
    id: 'followUpId',
    duration: expect.anything(),
    message: expect.anything(),
    status: 'completed',
  });
});
