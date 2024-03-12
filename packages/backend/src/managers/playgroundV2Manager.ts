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
import { Publisher } from '../utils/Publisher';
import type { Disposable, Webview } from '@podman-desktop/api';
import { Messages } from '@shared/Messages';
import type { IPlaygroundMessage } from '@shared/src/models/IPlaygroundMessage';
import type { InferenceManager } from './inference/inferenceManager';
import OpenAI from 'openai';
import {
  ChatCompletionChunk,
  ChatCompletionMessageParam, ChatCompletionSystemMessageParam,
  ChatCompletionUserMessageParam,
} from 'openai/src/resources/chat/completions';
import type { ModelOptions } from '@shared/src/models/IModelOptions';
import { Stream } from 'openai/streaming';

export class PlaygroundV2Manager extends Publisher<IPlaygroundMessage[]> implements Disposable {
  #messages: Map<string, IPlaygroundMessage>;
  #counter: number;

  constructor(
    webview: Webview,
    private inferenceManager: InferenceManager,
  ) {
    super(webview, Messages.MSG_PLAYGROUNDS_MESSAGES_UPDATE, () => this.getAll());
    this.#messages = new Map();
    this.#counter = 0;
  }

  private getUniqueId(): string {
    return `playground-${++this.#counter}`
  }

  async submit(containerId: string, modelId: string, userInput: string, options?: ModelOptions): Promise<void> {
    const server = this.inferenceManager.get(containerId);
    if (server === undefined) throw new Error('Inference server not found.');

    if (server.health.Status !== 'healthy')
      throw new Error(`Inference server is not healthy, currently status: ${server.health.Status}.`);

    const requestId = this.getUniqueId();
    this.#messages.set(requestId, {
      id: requestId,
      choices: [],
      timestamp: Date.now(),
      userInput: userInput,
      completed: false,
    });

    const client = new OpenAI({
      baseURL: `http://localhost:${server.connection.port}/v1`,
      apiKey: 'dummy',
      fetch: (url: RequestInfo, init?: RequestInit): Promise<Response> => this.fetchMiddleware(requestId, url, init),
    });

    const response = await client.chat.completions.create({
      messages: this.getFormattedMessages(),
      stream: true,
      model: modelId,
      ...options,
    });
    // process stream async
    this.processStream(requestId, response).catch((err) => {
      console.error('Something went wrong while processing stream', err);
    });
  }

  /**
   * OpenIA fetch middleware. Useful to intercept request body
   * @param requestId the linked requestId
   * @param url the url for the request
   * @param init the request init
   */
  private async fetchMiddleware(requestId: string, url: RequestInfo, init?: RequestInit): Promise<Response> {
    const message = this.#messages.get(requestId);
    if(message === undefined) {
      throw new Error('message not found, aborting stream process.')
    }
    this.#messages.set(requestId, {
      ...message,
      request: {
        body: `${init.body}`,
        url: `${url}`,
        method: `${init.method}`,
      },
    });
    this.notify();
    return fetch(url, init);
  }

  /**
   * Given a Stream from the OpenAI library update and notify the publisher
   * @param requestId
   * @param stream
   */
  private async processStream(requestId: string, stream: Stream<ChatCompletionChunk>): Promise<void> {
    for await (const chunk of stream) {
      const message = this.#messages.get(requestId);
      if(message === undefined) {
        console.error('message not found, aborting stream process.');
        // TODO: abort OpenAI request using AbortSignal.
        return;
      }
      this.#messages.set(requestId, {
        ...message,
        choices: [...message.choices, {
          role: chunk.choices[0]?.delta?.role,
          content: chunk.choices[0]?.delta?.content || '',
        }]
      });
      this.notify();
    }

    const message = this.#messages.get(requestId);
    if(message !== undefined) {
      this.#messages.set(requestId, {
        ...message,
        completed: true,
      });
      this.notify();
    }
  }

  /**
   * Transform the Map<string, IPlaygroundMessage> to OpenAI compatible object for chat interaction
   * @private
   */
  private getFormattedMessages(): ChatCompletionMessageParam[] {
    return this.getAll().reduce((previousValue, message) => {
      // first add the user input as message
      previousValue.push({
        content: message.userInput,
        role: 'user',
      } as ChatCompletionUserMessageParam);

      // then if completed add the system message
      if(message.completed) {
        previousValue.push({
          role: 'system',
          content: message.choices.map(choice => choice.content).join(''),
        } as ChatCompletionSystemMessageParam);
      }

      return previousValue;
    }, [] as ChatCompletionMessageParam[]);
  }

  getAll(): IPlaygroundMessage[] {
    return Array.from(this.#messages.values());
  }

  clear(): void {
    this.#messages.clear();
  }

  dispose(): void {
    this.clear();
  }
}
