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
import { experimental_createMCPClient as createMCPClient } from '@ai-sdk/mcp';
import { Experimental_StdioMCPTransport as StdioClientTransport } from '@ai-sdk/mcp/mcp-stdio';
import { type McpClient, type McpServer, McpServerType } from '@shared/models/McpSettings';

export async function toMcpClients(...mcpServers: McpServer[]): Promise<McpClient[]> {
  const clients: McpClient[] = [];
  for (const server of mcpServers) {
    switch (server.type) {
      case McpServerType.SSE:
        clients.push(
          await createMCPClient({
            name: server.name,
            transport: {
              type: 'sse',
              url: server.url,
              headers: server.headers,
            },
          }),
        );
        break;
      case McpServerType.STDIO:
        clients.push(
          await createMCPClient({
            name: server.name,
            transport: new StdioClientTransport({
              command: server.command,
              args: server.args,
            }),
          }),
        );
        break;
    }
  }
  return clients;
}
