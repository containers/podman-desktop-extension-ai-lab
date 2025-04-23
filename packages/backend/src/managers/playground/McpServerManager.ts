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
import type { Disposable } from '@podman-desktop/api';
import fs from 'node:fs';
import path from 'node:path';

const MCP_SETTINGS = 'mcp-settings.json';

export enum McpServerType {
  STDIO = 'stdio',
  SSE = 'sse',
}

export interface McpServer {
  name: string;
  enabled: boolean;
  type: McpServerType;
  command: string;
  args: string[];
  url: string;
  headers: Record<string, string>;
}

// TODO: Consider using JsonWatcher in case the file is going to be updated externally
export class McpServerManager implements Disposable {
  private readonly settingsFile: string;

  constructor(private appUserDirectory: string) {
    this.settingsFile = path.join(this.appUserDirectory, MCP_SETTINGS);
  }

  async load(): Promise<McpServer[]> {
    const mcpServers: McpServer[] = [];
    try {
      const mcpSettingsContent = await fs.promises.readFile(this.settingsFile, 'utf8');
      const mcpSettings = JSON.parse(mcpSettingsContent);
      if (!mcpSettings?.servers) {
        return mcpServers;
      }
      for (const entry of Object.entries(mcpSettings.servers)) {
        const mcpServer: McpServer = entry[1] as McpServer;
        mcpServer.name = entry[0];
        if (!Object.values(McpServerType).includes(mcpServer.type)) {
          console.warn(
            `McpServerManager: Invalid MCP server type ${mcpServer.type} for server ${mcpServer.name}. Defaulting to STDIO.`,
          );
          continue;
        }
        mcpServers.push(mcpServer);
      }
    } catch (error) {
      console.error(`McpServerManager: Failed to load MCP settings: ${error}`);
    }
    return mcpServers;
  }

  dispose(): void {
    // NO OP
  }
}
