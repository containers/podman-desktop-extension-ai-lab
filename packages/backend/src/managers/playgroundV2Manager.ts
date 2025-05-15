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
import type { Disposable, TelemetryLogger } from '@podman-desktop/api';
import type { InferenceManager } from './inference/inferenceManager';
import type { ModelOptions } from '@shared/models/IModelOptions';
import { ConversationRegistry } from '../registries/ConversationRegistry';
import type { Conversation, SystemPrompt, UserChat } from '@shared/models/IPlaygroundMessage';
import { isSystemPrompt } from '@shared/models/IPlaygroundMessage';
import type { ModelInfo } from '@shared/models/IModelInfo';
import { withDefaultConfiguration } from '../utils/inferenceUtils';
import { getRandomString } from '../utils/randomUtils';
import type { TaskRegistry } from '../registries/TaskRegistry';
import type { CancellationTokenRegistry } from '../registries/CancellationTokenRegistry';
import { getHash } from '../utils/sha';
import type { RpcExtension } from '@shared/messages/MessageProxy';
import { createOpenAICompatible } from '@ai-sdk/openai-compatible';
import { AiStreamProcessor } from './playground/aiSdk';
import { McpServerManager } from './playground/McpServerManager';
import type { ToolSet } from 'ai';
import { simulateStreamingMiddleware, wrapLanguageModel } from 'ai';
import { toMcpClients } from '../utils/mcpUtils';

export class PlaygroundV2Manager implements Disposable {
  readonly #conversationRegistry: ConversationRegistry;
  readonly #mcpServerManager: McpServerManager;

  constructor(
    appUserDirectory: string,
    rpcExtension: RpcExtension,
    private inferenceManager: InferenceManager,
    private taskRegistry: TaskRegistry,
    private telemetry: TelemetryLogger,
    private cancellationTokenRegistry: CancellationTokenRegistry,
  ) {
    this.#conversationRegistry = new ConversationRegistry(rpcExtension);
    this.#mcpServerManager = new McpServerManager(appUserDirectory);
  }

  deleteConversation(conversationId: string): void {
    const conversation = this.#conversationRegistry.get(conversationId);
    this.telemetry.logUsage('playground.delete', {
      totalMessages: conversation.messages.length,
      modelId: getHash(conversation.modelId),
    });
    this.#conversationRegistry.deleteConversation(conversationId);
  }

  async requestCreatePlayground(name: string, model: ModelInfo): Promise<string> {
    const trackingId: string = getRandomString();
    const task = this.taskRegistry.createTask('Creating Playground environment', 'loading', {
      trackingId: trackingId,
    });

    const telemetry: Record<string, unknown> = {
      hasName: !!name,
      modelId: getHash(model.id),
    };
    this.createPlayground(name, model, trackingId)
      .then((playgroundId: string) => {
        this.taskRegistry.updateTask({
          ...task,
          state: 'success',
          labels: {
            ...task.labels,
            playgroundId,
          },
        });
      })
      .catch((err: unknown) => {
        telemetry['errorMessage'] = `${String(err)}`;

        const tasks = this.taskRegistry.getTasksByLabels({
          trackingId: trackingId,
        });
        // Filter the one no in loading state
        tasks
          .filter(t => t.state === 'loading' && t.id !== task.id)
          .forEach(t => {
            this.taskRegistry.updateTask({
              ...t,
              state: 'error',
            });
          });
        // Update the main task
        this.taskRegistry.updateTask({
          ...task,
          state: 'error',
          error: `Something went wrong while trying to create a playground environment ${String(err)}.`,
        });
      })
      .finally(() => {
        this.telemetry.logUsage('playground.create', telemetry);
      });
    return trackingId;
  }

  async createPlayground(name: string, model: ModelInfo, trackingId: string): Promise<string> {
    if (!name) {
      name = this.getFreeName();
    }
    if (!this.isNameFree(name)) {
      throw new Error(`a playground with the name ${name} already exists`);
    }

    // Create conversation
    const conversationId = this.#conversationRegistry.createConversation(name, model.id);

    // create/start inference server if necessary
    const servers = this.inferenceManager.getServers();
    const server = servers.find(s => s.models.map(mi => mi.id).includes(model.id));
    if (!server) {
      await this.inferenceManager.createInferenceServer(
        await withDefaultConfiguration({
          modelsInfo: [model],
          labels: {
            trackingId: trackingId,
          },
        }),
      );
    } else if (server.status === 'stopped') {
      await this.inferenceManager.startInferenceServer(server.container.containerId);
    }

    return conversationId;
  }

  /**
   * Add a system prompt to an existing conversation.
   * @param conversationId the conversation to append the system prompt to.
   * @param content the content of the system prompt
   */
  private submitSystemPrompt(conversationId: string, content: string): void {
    this.#conversationRegistry.submit(conversationId, {
      content: content,
      role: 'system',
      id: this.#conversationRegistry.getUniqueId(),
      timestamp: Date.now(),
    } as SystemPrompt);
    this.telemetry.logUsage('playground.system-prompt.create', {
      modelId: getHash(this.#conversationRegistry.get(conversationId).modelId),
    });
  }

  /**
   * Given a conversation, update the system prompt.
   * If none exists, it will create one, otherwise it will replace the content with the new one
   * @param conversationId the conversation id to set the system id
   * @param content the new system prompt to use
   */
  setSystemPrompt(conversationId: string, content: string | undefined): void {
    const conversation = this.#conversationRegistry.get(conversationId);

    if (content === undefined || content.length === 0) {
      this.#conversationRegistry.removeMessage(conversationId, conversation.messages[0].id);
      this.telemetry.logUsage('playground.system-prompt.delete', {
        modelId: getHash(conversation.modelId),
      });
      return;
    }

    if (conversation.messages.length === 0) {
      this.submitSystemPrompt(conversationId, content);
    } else if (conversation.messages.length === 1 && isSystemPrompt(conversation.messages[0])) {
      this.#conversationRegistry.update(conversationId, conversation.messages[0].id, {
        content,
      });
      this.telemetry.logUsage('playground.system-prompt.update', {
        modelId: getHash(conversation.modelId),
      });
    } else {
      throw new Error('Cannot change system prompt on started conversation.');
    }
  }

  /**
   * @param conversationId
   * @param userInput the user input
   * @param options the model configuration
   */
  async submit(conversationId: string, userInput: string, options?: ModelOptions): Promise<number> {
    const conversation = this.#conversationRegistry.get(conversationId);

    const servers = this.inferenceManager.getServers();
    const server = servers.find(s => s.models.map(mi => mi.id).includes(conversation.modelId));
    if (server === undefined) throw new Error('Inference server not found.');

    if (server.status !== 'running') throw new Error('Inference server is not running.');

    if (server.health?.Status !== 'healthy')
      throw new Error(`Inference server is not healthy, currently status: ${server.health?.Status ?? 'unknown'}.`);

    const modelInfo = server.models.find(model => model.id === conversation.modelId);
    if (modelInfo === undefined)
      throw new Error(
        `modelId '${conversation.modelId}' is not available on the inference server, valid model ids are: ${server.models.map(model => model.id).join(', ')}.`,
      );

    this.#conversationRegistry.submit(conversation.id, {
      content: userInput,
      options: options,
      role: 'user',
      id: this.#conversationRegistry.getUniqueId(),
      timestamp: Date.now(),
    } as UserChat);

    if (!modelInfo.file?.path) throw new Error('model info has undefined file.');

    const telemetry: Record<string, unknown> = {
      conversationId: conversationId,
      ...options,
      promptLength: userInput.length,
      modelId: getHash(modelInfo.id),
    };

    const streamProcessor = new AiStreamProcessor(conversationId, this.#conversationRegistry);
    const cancelTokenId = this.cancellationTokenRegistry.createCancellationTokenSource(() => {
      streamProcessor.abortController.abort('cancel');
    });

    const tools: ToolSet = {};
    const mcpClients = await toMcpClients(...(await this.#mcpServerManager.load()));
    for (const client of mcpClients) {
      const clientTools = await client.tools();
      for (const entry of Object.entries(clientTools)) {
        tools[entry[0]] = entry[1];
      }
    }

    const openAiClient = createOpenAICompatible({
      name: modelInfo.name,
      baseURL: server.labels['api'] ?? `http://localhost:${server.connection.port}/v1`,
    });
    let model = openAiClient(modelInfo.name);
    // Tool calling in OpenAI doesn't support streaming yet
    if (Object.keys(tools).length > 0) {
      model = wrapLanguageModel({ model, middleware: simulateStreamingMiddleware() });
    }

    const start = Date.now();
    streamProcessor
      .stream(model, tools, options)
      .consumeStream()
      .then(() => {
        this.telemetry.logUsage('playground.message.complete', {
          duration: Date.now() - start,
          modelId: getHash(conversation.modelId),
        });
      })
      .catch((err: unknown) => {
        console.error('Something went wrong while processing stream', err);
      })
      .finally(() => {
        this.telemetry.logUsage('playground.submit', telemetry);
        this.cancellationTokenRegistry.delete(cancelTokenId);
        Promise.all(mcpClients.map(client => client.close())).catch((e: unknown) =>
          console.error(`Error closing MCP client`, e),
        );
      });

    return cancelTokenId;
  }

  getConversations(): Conversation[] {
    return this.#conversationRegistry.getAll();
  }

  private getFreeName(): string {
    const names = new Set(this.getConversations().map(c => c.name));
    let i = 0;
    let name: string;
    do {
      name = `playground ${++i}`;
    } while (names.has(name));
    return name;
  }

  private isNameFree(name: string): boolean {
    return !this.getConversations().some(c => c.name === name);
  }

  dispose(): void {
    this.#conversationRegistry.dispose();
  }
}
