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
import type { Disposable, TelemetryLogger, Webview } from '@podman-desktop/api';
import type { InferenceManager } from './inference/inferenceManager';
import OpenAI from 'openai';
import type { ChatCompletionChunk, ChatCompletionMessageParam } from 'openai/src/resources/chat/completions';
import type { ModelOptions } from '@shared/src/models/IModelOptions';
import type { Stream } from 'openai/streaming';
import { ConversationRegistry } from '../registries/ConversationRegistry';
import type { Conversation, PendingChat, SystemPrompt, UserChat } from '@shared/src/models/IPlaygroundMessage';
import { isSystemPrompt } from '@shared/src/models/IPlaygroundMessage';
import type { ModelInfo } from '@shared/src/models/IModelInfo';
import { withDefaultConfiguration } from '../utils/inferenceUtils';
import { getRandomString } from '../utils/randomUtils';
import type { TaskRegistry } from '../registries/TaskRegistry';

export class PlaygroundV2Manager implements Disposable {
  #conversationRegistry: ConversationRegistry;

  constructor(
    webview: Webview,
    private inferenceManager: InferenceManager,
    private taskRegistry: TaskRegistry,
    private telemetry: TelemetryLogger,
  ) {
    this.#conversationRegistry = new ConversationRegistry(webview);
  }

  deleteConversation(conversationId: string): void {
    const conversation = this.#conversationRegistry.get(conversationId);
    this.telemetry.logUsage('playground.delete', {
      totalMessages: conversation.messages.length,
      modelId: conversation.modelId,
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
      modelId: model.id,
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
      modelId: this.#conversationRegistry.get(conversationId).modelId,
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
        modelId: conversation.modelId,
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
        modelId: conversation.modelId,
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
  async submit(conversationId: string, userInput: string, options?: ModelOptions): Promise<void> {
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

    const client = new OpenAI({
      baseURL: `http://localhost:${server.connection.port}/v1`,
      apiKey: 'dummy',
    });

    if (!modelInfo.file?.file) throw new Error('model info has undefined file.');

    const telemetry: Record<string, unknown> = {
      conversationId: conversationId,
      ...options,
      promptLength: userInput.length,
      modelId: modelInfo.id,
    };

    client.chat.completions
      .create({
        messages: this.getFormattedMessages(conversation.id),
        stream: true,
        model: modelInfo.file.file,
        ...options,
      })
      .then(response => {
        // process stream async
        this.processStream(conversation.id, response).catch((err: unknown) => {
          console.error('Something went wrong while processing stream', err);
        });
      })
      .catch((err: unknown) => {
        telemetry['errorMessage'] = `${String(err)}`;
        console.error('Something went wrong while creating model response', err);
      })
      .finally(() => {
        this.telemetry.logUsage('playground.submit', telemetry);
      });
  }

  /**
   * Given a Stream from the OpenAI library update and notify the publisher
   * @param conversationId
   * @param stream
   */
  private async processStream(conversationId: string, stream: Stream<ChatCompletionChunk>): Promise<void> {
    const conversation = this.#conversationRegistry.get(conversationId);

    const messageId = this.#conversationRegistry.getUniqueId();
    const start = Date.now();
    this.#conversationRegistry.submit(conversationId, {
      role: 'assistant',
      choices: [],
      completed: undefined,
      id: messageId,
      timestamp: start,
    } as PendingChat);

    for await (const chunk of stream) {
      this.#conversationRegistry.appendChoice(conversationId, messageId, {
        content: chunk.choices[0]?.delta?.content || '',
      });
    }

    this.#conversationRegistry.completeMessage(conversationId, messageId);
    this.telemetry.logUsage('playground.message.complete', {
      duration: Date.now() - start,
      modelId: conversation.modelId,
    });
  }

  /**
   * Transform the ChatMessage interface to the OpenAI ChatCompletionMessageParam
   * @private
   */
  private getFormattedMessages(conversationId: string): ChatCompletionMessageParam[] {
    const conversation = this.#conversationRegistry.get(conversationId);
    if (!conversation) throw new Error(`conversation with id ${conversationId} does not exist.`);

    return conversation.messages.map(
      message =>
        ({
          name: undefined,
          ...message,
        }) as ChatCompletionMessageParam,
    );
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
