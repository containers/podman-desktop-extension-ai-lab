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
import { promises } from 'node:fs';
import path from 'node:path';
import { type McpSettings, type McpServer, McpServerType } from '../../models/mcpTypes';

// TODO: Agree on the name of the file and its location
const MCP_SETTINGS = 'mcp-settings.json';

// TODO: Consider using JsonWatcher in case the file is going to be updated externally
// Depending on the use case, we might want to watch for changes in the settings file.
// 1. As a user, I want to be able to modify the mcp-settings.json file and have the changes reflected in the application without restarting it.
// 2. As a user, I want to be able to add/remove servers from the mcp-settings.json while also having the application to provide a UI to manage the servers.
// 3. As a user, I don't want to tinker with the mcp-settings.json file and would like to have the application to provide a UI to manage the servers.
// Cases 1 and 2 are covered by JsonWatcher, but case 3 is not.
// For 2 and 3, we need to implement a UI to manage the servers.
export class McpServerManager implements Disposable {
  private readonly settingsFile: string;

  constructor(private appUserDirectory: string) {
    this.settingsFile = path.join(this.appUserDirectory, MCP_SETTINGS);
  }

  async load(): Promise<McpServer[]> {
    const mcpServers: McpServer[] = [];
    try {
      const mcpSettingsContent = await promises.readFile(this.settingsFile, 'utf8');
      const mcpSettings = JSON.parse(mcpSettingsContent) as McpSettings;
      if (!mcpSettings?.servers) {
        return mcpServers;
      }
      for (const entry of Object.entries(mcpSettings.servers)) {
        const mcpServer: McpServer = entry[1] as McpServer;
        mcpServer.name = entry[0];
        if (!Object.values(McpServerType).includes(mcpServer.type)) {
          console.warn(`McpServerManager: Invalid MCP server type ${mcpServer.type} for server ${mcpServer.name}.`);
          continue;
        }
        mcpServers.push(mcpServer);
      }
    } catch (error: unknown) {
      console.error(`McpServerManager: Failed to load MCP settings: ${error}`);
    }
    return mcpServers;
  }

  dispose(): void {
    // NO OP
  }
}
