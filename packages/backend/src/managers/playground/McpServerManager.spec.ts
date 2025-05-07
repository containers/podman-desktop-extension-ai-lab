/**********************************************************************
 * Copyright (C) 2025 Red Hat, Inc.
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
import { existsSync, promises } from 'node:fs';
import path from 'node:path';
import { EventEmitter, type FileSystemWatcher, fs } from '@podman-desktop/api';
import { type RpcExtension } from '@shared/messages/MessageProxy';
import { McpServerType } from '@shared/models/McpSettings';
import { TestEventEmitter } from '../../tests/utils';
import { McpServerManager } from './McpServerManager';

vi.mock('node:fs');
vi.mock('node:fs/promises');
vi.mock('@podman-desktop/api', () => ({
  EventEmitter: vi.fn(),
  fs: { createFileSystemWatcher: vi.fn() },
}));

/* eslint-disable sonarjs/no-nested-functions */
describe('McpServerManager publisher', () => {
  let rpcExtension: RpcExtension;
  let appUserDirectory: string;
  let onDidChangeBinding: () => void;
  let onDidCreateBinding: () => void;
  let onDidDeleteBinding: () => void;
  let mcpServerManager: McpServerManager;
  beforeEach(async () => {
    vi.resetAllMocks();
    vi.mocked(EventEmitter).mockImplementation(() => new TestEventEmitter() as unknown as EventEmitter<unknown>);
    vi.mocked(fs.createFileSystemWatcher).mockImplementation(
      () =>
        ({
          onDidChange: (fn: unknown) => (onDidChangeBinding = fn as () => void),
          onDidCreate: (fn: unknown) => (onDidCreateBinding = fn as () => void),
          onDidDelete: (fn: unknown) => (onDidDeleteBinding = fn as () => void),
        }) as unknown as FileSystemWatcher,
    );
    rpcExtension = { fire: vi.fn(() => Promise.resolve(true)) } as unknown as RpcExtension;
    appUserDirectory = path.join('/', 'tmp', 'mcp-server-manager-test-');
    mcpServerManager = new McpServerManager(rpcExtension, appUserDirectory);
  });
  test('provides an empty default value', () => {
    expect(mcpServerManager.getMcpSettings()).toEqual({ servers: {} });
  });
  describe('with non-parseable mcp-settings.json', () => {
    beforeEach(async () => {
      vi.spyOn(console, 'error');
      vi.mocked(existsSync).mockReturnValue(true);
      vi.mocked(promises.readFile).mockResolvedValue(
        JSON.stringify({
          servers: { 'initial-server': { type: 'stdio' } },
        }),
      );
      onDidCreateBinding();
      await vi.waitFor(() => expect(mcpServerManager.getMcpSettings().servers).not.toEqual({}));
      vi.mocked(promises.readFile).mockResolvedValue('{invalid json}');
    });
    test.each<{ fn: () => void; event: string }>([
      { fn: (): void => onDidChangeBinding(), event: 'onDidChange' },
      { fn: (): void => onDidCreateBinding(), event: 'onDidCreate' },
    ])('JsonWatcher[$event](), fails, initial servers are preserved', async ({ fn }) => {
      fn();
      await vi.waitFor(() =>
        expect(console.error).toHaveBeenCalledWith(
          expect.stringMatching(/Something went wrong JsonWatcher/),
          expect.anything(),
        ),
      );
      expect(mcpServerManager.getMcpSettings()).toEqual({
        servers: { 'initial-server': { name: 'initial-server', type: 'stdio' } },
      });
    });
    test('does not notify changes', async () => {
      vi.mocked(rpcExtension.fire).mockClear();
      onDidCreateBinding();
      await vi.waitFor(() =>
        expect(console.error).toHaveBeenCalledWith(
          expect.stringMatching(/Something went wrong JsonWatcher/),
          expect.anything(),
        ),
      );
      expect(rpcExtension.fire).not.toHaveBeenCalled();
    });
  });
  describe('with parseable mcp-settings.json', () => {
    beforeEach(() => {
      const mcpSettings = {
        servers: {
          'stdio-ok': {
            enabled: true,
            type: 'stdio',
            command: 'npx',
            args: ['-y', 'kubernetes-mcp-server'],
          },
          'sse-ok': {
            enabled: true,
            type: 'sse',
            url: 'https://echo.example.com/sse',
            headers: {
              foo: 'bar',
            },
          },
          'invalid-type': {
            enabled: true,
            type: 'invalid',
            url: 'https://echo.example.com/sse',
          },
        },
      };
      vi.mocked(existsSync).mockReturnValue(true);
      vi.mocked(promises.readFile).mockResolvedValue(JSON.stringify(mcpSettings));
    });
    test.each<{ fn: () => void; event: string }>([
      { fn: (): void => onDidChangeBinding(), event: 'onDidChange' },
      { fn: (): void => onDidCreateBinding(), event: 'onDidCreate' },
    ])('JsonWatcher[$event](), loads servers of supported types', async ({ fn }) => {
      fn();
      await vi.waitFor(() => {
        expect(mcpServerManager.getMcpSettings().servers).not.toEqual({});
        expect(Object.keys(mcpServerManager.getMcpSettings().servers)).toHaveLength(2);
      });
      expect(mcpServerManager.getMcpSettings().servers).toEqual(
        expect.objectContaining({
          'stdio-ok': {
            enabled: true,
            name: 'stdio-ok',
            type: McpServerType.STDIO,
            command: 'npx',
            args: ['-y', 'kubernetes-mcp-server'],
          },
          'sse-ok': {
            enabled: true,
            name: 'sse-ok',
            type: McpServerType.SSE,
            url: 'https://echo.example.com/sse',
            headers: { foo: 'bar' },
          },
        }),
      );
      expect(mcpServerManager.getMcpSettings().servers['invalid-type']).toBeUndefined();
    });
    test('notifies changes', async () => {
      onDidCreateBinding();
      await vi.waitFor(() => expect(mcpServerManager.getMcpSettings().servers).not.toEqual({}));
      expect(rpcExtension.fire).toHaveBeenLastCalledWith(expect.objectContaining({ channel: 'mcp-servers-update' }), {
        servers: expect.toSatisfy(servers => Object.values(servers).length === 2),
      });
    });
  });
  describe('with deleted mcp-settings.json', () => {
    beforeEach(async () => {
      vi.mocked(existsSync).mockReturnValue(true);
      vi.mocked(promises.readFile).mockResolvedValue(
        JSON.stringify({
          servers: {
            'stdio-ok': { type: 'stdio' },
          },
        }),
      );
      onDidCreateBinding();
      await vi.waitFor(() => expect(mcpServerManager.getMcpSettings().servers).not.toEqual({}));
      vi.mocked(existsSync).mockReturnValue(false);
    });
    test.each<{ fn: () => void; event: string }>([
      { fn: (): void => onDidChangeBinding(), event: 'onDidChange' },
      { fn: (): void => onDidDeleteBinding(), event: 'onDidDelete' },
    ])('JsonWatcher[$event](), loads empty servers', async ({ fn }) => {
      fn();
      await vi.waitFor(() => expect(mcpServerManager.getMcpSettings().servers).toEqual({}));
    });
    test('notifies changes', async () => {
      onDidDeleteBinding();
      await vi.waitFor(() => expect(mcpServerManager.getMcpSettings().servers).toEqual({}));
      expect(rpcExtension.fire).toHaveBeenLastCalledWith(expect.objectContaining({ channel: 'mcp-servers-update' }), {
        servers: {},
      });
    });
  });
});
