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
import { beforeEach, describe, expect, test, vi } from 'vitest';
import { promises, existsSync, mkdirSync } from 'node:fs';
import type { FileSystemWatcher } from '@podman-desktop/api';
import { EventEmitter, fs } from '@podman-desktop/api';
import { JsonWatcher } from './JsonWatcher';

vi.mock('@podman-desktop/api', () => {
  return {
    EventEmitter: vi.fn(),
    fs: {
      createFileSystemWatcher: () => ({
        onDidCreate: vi.fn(),
        onDidDelete: vi.fn(),
        onDidChange: vi.fn(),
      }),
    },
  };
});

vi.mock('node:fs', () => {
  return {
    existsSync: vi.fn(),
    mkdirSync: vi.fn(),
    promises: {
      readFile: vi.fn(),
    },
  };
});

beforeEach(() => {
  vi.resetAllMocks();
  // Mock event emitters
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

test('should provide default value', async () => {
  vi.mocked(existsSync).mockReturnValue(false);
  const watcher = new JsonWatcher<string>('dummyPath', 'dummyDefaultvalue');
  const listener = vi.fn();
  watcher.onContentUpdated(listener);

  watcher.init();

  await vi.waitFor(() => {
    expect(listener).toHaveBeenCalledWith('dummyDefaultvalue');
  });
  expect(mkdirSync).toHaveBeenCalled();
  expect(existsSync).toHaveBeenCalledWith('dummyPath');
  expect(promises.readFile).not.toHaveBeenCalled();
});

test('should read file content', async () => {
  vi.mocked(existsSync).mockReturnValue(true);
  vi.spyOn(promises, 'readFile').mockResolvedValue('["hello"]');
  const watcher = new JsonWatcher<string[]>('dummyPath', []);
  const listener = vi.fn();
  watcher.onContentUpdated(listener);

  watcher.init();

  await vi.waitFor(() => {
    expect(listener).toHaveBeenCalledWith(['hello']);
  });
  expect(promises.readFile).toHaveBeenCalledWith('dummyPath', 'utf-8');
});

describe('file system watcher events should fire onContentUpdated', () => {
  let onDidCreateListener: () => void;
  let onDidDeleteListener: () => void;
  let onDidChangeListener: () => void;
  beforeEach(() => {
    vi.spyOn(fs, 'createFileSystemWatcher').mockReturnValue({
      onDidCreate: vi.fn().mockImplementation(listener => (onDidCreateListener = listener)),
      onDidDelete: vi.fn().mockImplementation(listener => (onDidDeleteListener = listener)),
      onDidChange: vi.fn().mockImplementation(listener => (onDidChangeListener = listener)),
    } as unknown as FileSystemWatcher);
  });

  test('onDidCreate', async () => {
    vi.mocked(existsSync).mockReturnValue(false);
    const watcher = new JsonWatcher<string>('dummyPath', 'dummyDefaultValue');
    const listener = vi.fn();
    watcher.onContentUpdated(listener);
    watcher.init();

    expect(onDidCreateListener).toBeDefined();
    onDidCreateListener();

    await vi.waitFor(() => {
      expect(listener).toHaveBeenNthCalledWith(2, 'dummyDefaultValue');
    });
  });

  test('onDidDeleteListener', async () => {
    vi.mocked(existsSync).mockReturnValue(false);
    const watcher = new JsonWatcher<string>('dummyPath', 'dummyDefaultValue');
    const listener = vi.fn();
    watcher.onContentUpdated(listener);
    watcher.init();

    expect(onDidDeleteListener).toBeDefined();
    onDidDeleteListener();

    await vi.waitFor(() => {
      expect(listener).toHaveBeenNthCalledWith(2, 'dummyDefaultValue');
    });
  });

  test('onDidChangeListener', async () => {
    vi.mocked(existsSync).mockReturnValue(false);
    const watcher = new JsonWatcher<string>('dummyPath', 'dummyDefaultValue');
    const listener = vi.fn();
    watcher.onContentUpdated(listener);
    watcher.init();

    expect(onDidChangeListener).toBeDefined();
    onDidChangeListener();

    await vi.waitFor(() => {
      expect(listener).toHaveBeenNthCalledWith(2, 'dummyDefaultValue');
    });
  });
});
