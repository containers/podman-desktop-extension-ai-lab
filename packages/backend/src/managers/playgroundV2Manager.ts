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
import type { PlaygroundV2 } from '@shared/src/models/IPlaygroundV2';
import { Publisher } from '../utils/Publisher';
import { Messages } from '@shared/Messages';
import type { ModelInfo } from '@shared/src/models/IModelInfo';
import { withDefaultConfiguration } from '../utils/inferenceUtils';

export class PlaygroundV2Manager extends Publisher<PlaygroundV2[]> implements Disposable {
  #playgrounds: Map<string, PlaygroundV2>;
  #conversationRegistry: ConversationRegistry;
  #playgroundCounter = 0;
  #UIDcounter: number;

  constructor(
    webview: Webview,
    private inferenceManager: InferenceManager,
  ) {
    super(webview, Messages.MSG_PLAYGROUNDS_V2_UPDATE, () => this.getPlaygrounds());
    this.#playgrounds = new Map();
    this.#conversationRegistry = new ConversationRegistry(webview);
    this.#UIDcounter = 0;
  }

  deletePlayground(conversationId: string): void {
    this.#conversationRegistry.deleteConversation(conversationId);
    this.#playgrounds.delete(conversationId);
  }

  async createPlayground(name: string, model: ModelInfo): Promise<void> {
    const id = `${this.#playgroundCounter++}`;

    if (!name) {
      name = this.getFreeName();
    }

    this.#conversationRegistry.createConversation(id);
    this.#playgrounds.set(id, {
      id,
      name,
      modelId: model.id,
    });

    // create/start inference server if necessary
    const servers = this.inferenceManager.getServers();
    const server = servers.find(s => s.models.map(mi => mi.id).includes(model.id));
    if (!server) {
      await this.inferenceManager.createInferenceServer(
        await withDefaultConfiguration({
          modelsInfo: [model],
        }),
        `playground-tracking-${id}`,
      );
    } else if (server.status === 'stopped') {
      await this.inferenceManager.startInferenceServer(server.container.containerId);
    }
    this.notify();
  }

  getPlaygrounds(): PlaygroundV2[] {
    return Array.from(this.#playgrounds.values());
  }

  private getUniqueId(): string {
    return `playground-${++this.#UIDcounter}`;
  }

  /**
   * @param playgroundId
   * @param userInput the user input
   * @param options the model configuration
   */
  async submit(playgroundId: string, userInput: string, systemPrompt: string, options?: ModelOptions): Promise<void> {
    const playground = this.#playgrounds.get(playgroundId);
    if (playground === undefined) throw new Error('Playground not found.');

    const servers = this.inferenceManager.getServers();
    const server = servers.find(s => s.models.map(mi => mi.id).includes(playground.modelId));
    if (server === undefined) throw new Error('Inference server not found.');

    if (server.status !== 'running') throw new Error('Inference server is not running.');

    if (server.health?.Status !== 'healthy')
      throw new Error(`Inference server is not healthy, currently status: ${server.health.Status}.`);

    const modelInfo = server.models.find(model => model.id === playground.modelId);
    if (modelInfo === undefined)
      throw new Error(
        `modelId '${playground.modelId}' is not available on the inference server, valid model ids are: ${server.models.map(model => model.id).join(', ')}.`,
      );

    const conversation = this.#conversationRegistry.get(playground.id);
    if (conversation === undefined) throw new Error(`conversation with id ${playground.id} does not exist.`);

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

    const messages = this.getFormattedMessages(playground.id);
    if (systemPrompt) {
      messages.push({ role: 'system', content: systemPrompt });
    }
    client.chat.completions
      .create({
        messages,
        stream: true,
        model: modelInfo.file.file,
        ...options,
      })
      .then(response => {
        // process stream async
        this.processStream(playground.id, response).catch((err: unknown) => {
          console.error('Something went wrong while processing stream', err);
        });
      })
      .catch((err: unknown) => {
        console.error('Something went wrong while creating model reponse', err);
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

  getFreeName(): string {
    let i = 0;
    let name: string;
    do {
      name = `playground ${++i}`;
    } while (this.getPlaygrounds().find(p => p.name === name));
    return name;
  }
}
