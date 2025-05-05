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
import { promises } from 'node:fs';
import path from 'node:path';
import { type McpServer, McpServerType } from '../../models/mcpTypes';
import { McpServerManager } from './McpServerManager';

vi.mock('node:fs');
vi.mock('node:fs/promises');

/* eslint-disable sonarjs/no-nested-functions */
describe('McpServerManager', () => {
  let appUserDirectory: string;
  beforeEach(async () => {
    vi.resetAllMocks();
    appUserDirectory = path.join('/', 'tmp', 'mcp-server-manager-test-');
  });
  describe('load', () => {
    test('with no file, returns empty array', async () => {
      const mcpServerManager = new McpServerManager(appUserDirectory);
      const mcpServers = await mcpServerManager.load();
      expect(mcpServers).toEqual([]);
    });
    test('with empty file, returns empty array', async () => {
      const mcpServerManager = new McpServerManager(appUserDirectory);
      vi.mocked(promises.readFile).mockResolvedValue('{}');
      const mcpServers = await mcpServerManager.load();
      expect(mcpServers).toEqual([]);
    });
    test('with invalid JSON, returns empty array', async () => {
      const mcpServerManager = new McpServerManager(appUserDirectory);
      vi.mocked(promises.readFile).mockResolvedValue('{invalid json}');
      const mcpServers = await mcpServerManager.load();
      expect(mcpServers).toEqual([]);
    });
    describe('with valid JSON', () => {
      let mcpServers: McpServer[];
      beforeEach(async () => {
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
        vi.mocked(promises.readFile).mockResolvedValue(JSON.stringify(mcpSettings));
        mcpServers = await new McpServerManager(appUserDirectory).load();
      });
      test('parses stdio server', async () => {
        expect(mcpServers).toEqual(
          expect.arrayContaining([
            {
              name: 'stdio-ok',
              enabled: true,
              type: McpServerType.STDIO,
              command: 'npx',
              args: ['-y', 'kubernetes-mcp-server'],
            },
          ]),
        );
      });
      test('parses sse server', async () => {
        const sseOk: McpServer | undefined = mcpServers.find(server => server.name === 'sse-ok');
        expect(sseOk).toEqual({
          name: 'sse-ok',
          enabled: true,
          type: McpServerType.SSE,
          url: 'https://echo.example.com/sse',
          headers: { foo: 'bar' },
        });
      });
      test('ignores invalid type', async () => {
        const invalidType: McpServer | undefined = mcpServers.find(server => server.name === 'invalid-type');
        expect(invalidType).toBeUndefined();
      });
    });
  });
});
