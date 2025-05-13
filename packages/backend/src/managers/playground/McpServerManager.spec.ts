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
import path from 'node:path';
import { type RpcExtension } from '@shared/messages/MessageProxy';
import { type McpClient, type McpServer, McpServerType, type McpSettings } from '@shared/models/McpSettings';
import { McpServerManager } from './McpServerManager';
import { JsonWatcher } from '../../utils/JsonWatcher';
import { toMcpClients } from '../../utils/mcpUtils';

vi.mock('../../utils/JsonWatcher');
vi.mock('../../utils/mcpUtils');

let mockJsonWatcher: JsonWatcher<McpSettings>;
let rpcExtension: RpcExtension;
let update: (mcpSettings: McpSettings) => void;
let appUserDirectory: string;
let mcpServerManager: McpServerManager;
beforeEach(async () => {
  vi.resetAllMocks();
  mockJsonWatcher = {
    init: vi.fn(),
    dispose: vi.fn(),
    onContentUpdated: vi.fn((fn: (mcpSettings: McpSettings) => void) => (update = fn)),
  } as unknown as JsonWatcher<McpSettings>;
  vi.mocked(JsonWatcher).mockReturnValue(mockJsonWatcher);
  vi.mocked(toMcpClients).mockImplementation(async (...mcpServers) =>
    mcpServers.map(s => ({ name: s.name }) as unknown as McpClient),
  );
  rpcExtension = { fire: vi.fn(() => Promise.resolve(true)) } as unknown as RpcExtension;
  appUserDirectory = path.join('/', 'tmp', 'mcp-server-manager-test-');
  mcpServerManager = new McpServerManager(rpcExtension, appUserDirectory);
});
test('provides an empty default value', () => {
  expect(mcpServerManager.getMcpSettings()).toEqual({ servers: {} });
});
test('init initializes the watcher', () => {
  mcpServerManager.init();
  expect(mockJsonWatcher.init).toHaveBeenCalled();
});
test('dispose disposes the watcher', () => {
  mcpServerManager.dispose();
  expect(mockJsonWatcher.dispose).toHaveBeenCalled();
});
describe('when loading mcp-settings.json', () => {
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
    } as unknown as McpSettings;
    update(mcpSettings);
  });
  test('loads valid servers', () => {
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
  });
  test('ignores invalid servers', () => {
    expect(mcpServerManager.getMcpSettings().servers['invalid-type']).toBeUndefined();
  });
});
test('toMcpClients returns the enabled servers', async () => {
  mcpServerManager.init();
  update({
    servers: {
      enabled: { enabled: true, type: McpServerType.STDIO } as unknown as McpServer,
      disabled: { enabled: false, type: McpServerType.STDIO } as unknown as McpServer,
    },
  });
  const mcpClients = await mcpServerManager.toMcpClients();
  expect(mcpClients).toEqual([{ name: 'enabled' }]);
});
