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
import type {
  ChatCompletionChunk,
  ChatCompletionMessageParam,
} from 'openai/src/resources/chat/completions';
import type { ModelOptions } from '@shared/src/models/IModelOptions';
import type { Stream } from 'openai/streaming';
import { ConversationRegistry } from '../registries/conversationRegistry';
import type { Conversation, PendingChat, UserChat } from '@shared/src/models/IPlaygroundMessage';

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
    return `playground-${++this.#counter}`;
  }

  createConversation(): string {
    return this.#conversationRegistry.createConversation();
  }

  /**
   * @param containerId must be corresponding to an inference server container
   * @param modelId the model to use, should be included in the inference server matching the containerId
   * @param conversationId the conversation id to happen the message to.
   * @param userInput the user input
   * @param options the model configuration
   */
  async submit(containerId: string, modelId: string, conversationId: string, userInput: string, options?: ModelOptions): Promise<void> {
    const server = this.inferenceManager.get(containerId);
    if (server === undefined) throw new Error('Inference server not found.');

    if (server.status !== 'running') throw new Error('Inference server is not running.');

    if (server.health?.Status !== 'healthy')
      throw new Error(`Inference server is not healthy, currently status: ${server.health.Status}.`);

    const modelInfo = server.models.find(model => model.id === modelId);
    if (modelInfo === undefined)
      throw new Error(
        `modelId '${modelId}' is not available on the inference server, valid model ids are: ${server.models.map(model => model.id).join(', ')}.`,
      );

    const conversation = this.#conversationRegistry.get(conversationId);
    if(conversation === undefined)
      throw new Error(`conversation with id ${conversationId} does not exist.`);

    this.#conversationRegistry.submit(conversation.id, {
      content: userInput,
      options: options,
      role: 'user',
      id: this.getUniqueId(),
      timestamp: Date.now(),
    } as UserChat);

    const client = new OpenAI({
      baseURL: `http://localhost:${server.connection.port}/v1`,
      apiKey: 'dummy',
    });

    const response = await client.chat.completions.create({
      messages: this.getFormattedMessages(conversationId),
      stream: true,
      model: modelInfo.file.file,
      ...options,
    });
    // process stream async
    this.processStream(conversationId, response).catch((err: unknown) => {
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
      completed: false,
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
    return this.#conversationRegistry.get(conversationId).messages.map((message) => ({
      name: undefined,
      ...message,
    } as ChatCompletionMessageParam));
  }

  getConversations(): Conversation[] {
    return this.#conversationRegistry.getAll();
  }

  dispose(): void {
    this.#conversationRegistry.dispose();
  }
}
