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
import type { Disposable, Webview } from '@podman-desktop/api';
import type { InferenceManager } from './inference/inferenceManager';
import OpenAI from 'openai';
import type { ChatCompletionChunk, ChatCompletionMessageParam } from 'openai/src/resources/chat/completions';
import type { ModelOptions } from '@shared/src/models/IModelOptions';
import type { Stream } from 'openai/streaming';
import { ConversationRegistry } from '../registries/conversationRegistry';
import type { Conversation, PendingChat, UserChat } from '@shared/src/models/IPlaygroundMessage';
import type { ModelInfo } from '@shared/src/models/IModelInfo';
import { withDefaultConfiguration } from '../utils/inferenceUtils';

export class PlaygroundV2Manager implements Disposable {
  #conversationRegistry: ConversationRegistry;
  #counter: number;

  constructor(
    webview: Webview,
    private inferenceManager: InferenceManager,
  ) {
    this.#conversationRegistry = new ConversationRegistry(webview);
    this.#counter = 0;
  }

  private getUniqueId(): string {
    return `id-${++this.#counter}`;
  }

  async createConversation(model: ModelInfo, name?: string): Promise<void> {
    if (!name) {
      name = this.getFreeName();
    }

    const conversationId = this.#conversationRegistry.createConversation(model.id, name);

    // create/start inference server if necessary
    const servers = this.inferenceManager.getServers();
    const server = servers.find(s => s.models.map(mi => mi.id).includes(model.id));
    if (!server) {
      await this.inferenceManager.createInferenceServer(
        await withDefaultConfiguration({
          modelsInfo: [model],
        }),
        `tracking-${conversationId}`,
      );
    } else if (server.status === 'stopped') {
      await this.inferenceManager.startInferenceServer(server.container.containerId);
    }
  }

  /**
   * @param conversationId
   * @param userInput the user input
   * @param options the model configuration
   */
  async submit(conversationId: string, userInput: string, options?: ModelOptions): Promise<void> {
    const conversation = this.#conversationRegistry.get(conversationId);
    if (conversation === undefined) throw new Error(`conversation with id ${conversationId} does not exist.`);

    const servers = this.inferenceManager.getServers();
    const server = servers.find(s => s.models.map(mi => mi.id).includes(conversation.modelId));
    if (server === undefined) throw new Error('Inference server not found.');

    if (server.status !== 'running') throw new Error('Inference server is not running.');

    if (server.health?.Status !== 'healthy')
      throw new Error(`Inference server is not healthy, currently status: ${server.health.Status}.`);

    const modelInfo = server.models.find(model => model.id === conversation.modelId);
    if (modelInfo === undefined)
      throw new Error(
        `modelId '${conversation.modelId}' is not available on the inference server, valid model ids are: ${server.models.map(model => model.id).join(', ')}.`,
      );

    this.#conversationRegistry.submit(conversation.id, {
      content: userInput,
      options: options,
      role: 'user',
      timestamp: Date.now(),
      id: this.getUniqueId(),
    } as UserChat);

    const client = new OpenAI({
      baseURL: `http://localhost:${server.connection.port}/v1`,
      apiKey: 'dummy',
    });

    const response = await client.chat.completions.create({
      messages: this.getFormattedMessages(conversation.id),
      stream: true,
      model: modelInfo.file.file,
      ...options,
    });
    // process stream async
    this.processStream(conversation.id, response).catch((err: unknown) => {
      console.error('Something went wrong while processing stream', err);
    });
  }

  /**
   * Given a Stream from the OpenAI library update and notify the publisher
   * @param conversationId
   * @param stream
   */
  private async processStream(conversationId: string, stream: Stream<ChatCompletionChunk>): Promise<void> {
    const messageId = this.getUniqueId();
    this.#conversationRegistry.submit(conversationId, {
      role: 'assistant',
      choices: [],
      completed: undefined,
      id: messageId,
      timestamp: Date.now(),
    } as PendingChat);

    for await (const chunk of stream) {
      this.#conversationRegistry.appendChoice(conversationId, messageId, {
        content: chunk.choices[0]?.delta?.content || '',
      });
    }

    this.#conversationRegistry.completeMessage(conversationId, messageId);
  }

  /**
   * Transform the ChatMessage interface to the OpenAI ChatCompletionMessageParam
   * @private
   */
  private getFormattedMessages(conversationId: string): ChatCompletionMessageParam[] {
    return this.#conversationRegistry.get(conversationId).messages.map(
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

  dispose(): void {
    this.#conversationRegistry.dispose();
  }

  private getFreeName(): string {
    return `Playground ${this.#conversationRegistry.getAll().length + 1}`;
  }
}
