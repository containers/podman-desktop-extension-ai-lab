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
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import type { McpServer } from './McpServerManager';
import { McpServerType, McpServerManager } from './McpServerManager';

/* eslint-disable sonarjs/no-nested-functions */
describe('McpServerManager', () => {
  let appUserDirectory: string;
  let consoleErrors: string;
  let consoleWarnings: string;
  beforeEach(async () => {
    appUserDirectory = await fs.promises.mkdtemp(path.join(os.tmpdir(), 'mcp-server-manager-test-'));
    consoleErrors = '';
    vi.spyOn(console, 'error').mockImplementation((...args) => {
      consoleErrors += args.join(' ') + '\n';
    });
    consoleWarnings = '';
    vi.spyOn(console, 'warn').mockImplementation((...args) => {
      consoleWarnings += args.join(' ') + '\n';
    });
  });
  afterEach(async () => {
    await fs.promises.rm(appUserDirectory, { recursive: true });
  });
  describe('load', () => {
    test('with no file, returns empty array', async () => {
      const mcpServerManager = new McpServerManager(appUserDirectory);
      const mcpServers = await mcpServerManager.load();
      expect(mcpServers).toEqual([]);
      expect(consoleErrors).toContain('McpServerManager: Failed to load MCP settings');
      expect(consoleWarnings).toBe('');
    });
    test('with empty file, returns empty array', async () => {
      const mcpServerManager = new McpServerManager(appUserDirectory);
      const mcpSettingsFile = path.join(appUserDirectory, 'mcp-settings.json');
      await fs.promises.writeFile(mcpSettingsFile, '{}');
      const mcpServers = await mcpServerManager.load();
      expect(mcpServers).toEqual([]);
      expect(consoleErrors).toBe('');
      expect(consoleWarnings).toBe('');
    });
    test('with invalid JSON, returns empty array', async () => {
      const mcpServerManager = new McpServerManager(appUserDirectory);
      const mcpSettingsFile = path.join(appUserDirectory, 'mcp-settings.json');
      await fs.promises.writeFile(mcpSettingsFile, '{invalid json}');
      const mcpServers = await mcpServerManager.load();
      expect(mcpServers).toEqual([]);
      expect(consoleErrors).toContain('McpServerManager: Failed to load MCP settings');
      expect(consoleWarnings).toBe('');
    });
    describe('with valid JSON', () => {
      let mcpServers: McpServer[];
      beforeEach(async () => {
        const mcpSettingsFile = path.join(appUserDirectory, 'mcp-settings.json');
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
        fs.writeFileSync(mcpSettingsFile, JSON.stringify(mcpSettings));
        mcpServers = await new McpServerManager(appUserDirectory).load();
      });
      test('parses stdio server', async () => {
        const stdioOk: McpServer | undefined = mcpServers.find(server => server.name === 'stdio-ok');
        expect(stdioOk).toEqual({
          name: 'stdio-ok',
          enabled: true,
          type: McpServerType.STDIO,
          command: 'npx',
          args: ['-y', 'kubernetes-mcp-server'],
        });
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
        expect(consoleWarnings).toContain('McpServerManager: Invalid MCP server type invalid for server invalid-type.');
      });
    });
  });
});
