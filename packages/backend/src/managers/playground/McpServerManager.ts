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
import path from 'node:path';
import { type Disposable } from '@podman-desktop/api';
import { MSG_MCP_SERVERS_UPDATE } from '@shared/Messages';
import { type McpSettings, McpServerType, type McpClient } from '@shared/models/McpSettings';
import type { RpcExtension } from '@shared/messages/MessageProxy';
import { JsonWatcher } from '../../utils/JsonWatcher';
import { Publisher } from '../../utils/Publisher';
import { toMcpClients } from '../../utils/mcpUtils';

// TODO: Agree on the name of the file and its location
const MCP_SETTINGS = 'mcp-settings.json';

export class McpServerManager extends Publisher<McpSettings> implements Disposable {
  private readonly settingsFile: string;
  private mcpSettings: McpSettings;
  readonly #jsonWatcher: JsonWatcher<McpSettings>;

  constructor(
    rpcExtension: RpcExtension,
    private appUserDirectory: string,
  ) {
    super(rpcExtension, MSG_MCP_SERVERS_UPDATE, () => this.getMcpSettings());
    this.settingsFile = path.join(this.appUserDirectory, MCP_SETTINGS);
    this.mcpSettings = {
      servers: {},
    };
    this.#jsonWatcher = new JsonWatcher<McpSettings>(this.settingsFile, { ...this.mcpSettings });
    this.#jsonWatcher.onContentUpdated(this.onMcpSettingsUpdated.bind(this));
  }

  /**
   * Lazily initialize the MCP server manager dependencies.
   */
  init(): void {
    this.#jsonWatcher.init();
  }

  private onMcpSettingsUpdated(mcpSettings: McpSettings): void {
    this.mcpSettings = { servers: {} };
    for (const [name, mcpServer] of Object.entries(mcpSettings.servers ?? {})) {
      mcpServer.name = name;
      if (!Object.values(McpServerType).includes(mcpServer.type)) {
        console.warn(`McpServerManager: Invalid MCP server type ${mcpServer.type} for server ${mcpServer.name}.`);
        continue;
      }
      this.mcpSettings.servers[name] = mcpServer;
    }
    this.notify();
  }

  getMcpSettings(): McpSettings {
    return this.mcpSettings;
  }

  async toMcpClients(): Promise<McpClient[]> {
    const enabledServers = Object.values(this.mcpSettings.servers).filter(server => server.enabled);
    return toMcpClients(...enabledServers);
  }

  dispose(): void {
    this.#jsonWatcher.dispose();
  }
}
