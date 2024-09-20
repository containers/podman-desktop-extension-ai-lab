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
import type {
  AssistantChat,
  ChatMessage,
  Choice,
  Conversation,
  Message,
  PendingChat,
} from '@shared/src/models/IPlaygroundMessage';
import {
  type Disposable,
  type Webview,
  type ContainerCreateOptions,
  containerEngine,
  type ContainerProviderConnection,
  type ImageInfo,
  type PullEvent,
} from '@podman-desktop/api';
import { Messages } from '@shared/Messages';
import type { ConfigurationRegistry } from './ConfigurationRegistry';
import path from 'node:path';
import fs from 'node:fs';
import type { InferenceServer } from '@shared/src/models/IInference';
import { getFreeRandomPort } from '../utils/ports';
import { DISABLE_SELINUX_LABEL_SECURITY_OPTION } from '../utils/utils';
import { getImageInfo } from '../utils/inferenceUtils';
import type { TaskRegistry } from './TaskRegistry';
import type { PodmanConnection } from '../managers/podmanConnection';

export class ConversationRegistry extends Publisher<Conversation[]> implements Disposable {
  #conversations: Map<string, Conversation>;
  #counter: number;

  constructor(
    webview: Webview,
    private configurationRegistry: ConfigurationRegistry,
    private taskRegistry: TaskRegistry,
    private podmanConnection: PodmanConnection,
  ) {
    super(webview, Messages.MSG_CONVERSATIONS_UPDATE, () => this.getAll());
    this.#conversations = new Map<string, Conversation>();
    this.#counter = 0;
  }

  getUniqueId(): string {
    return `${++this.#counter}`;
  }

  /**
   * Remove a message from a conversation
   * @param conversationId
   * @param messageId
   */
  removeMessage(conversationId: string, messageId: string): void {
    const conversation: Conversation = this.get(conversationId);

    conversation.messages = conversation.messages.filter(message => message.id !== messageId);
    this.notify();
  }

  /**
   * Utility method to update a message content in a given conversation
   * @param conversationId
   * @param messageId
   * @param message
   */
  update(conversationId: string, messageId: string, message: Partial<ChatMessage>): void {
    const conversation: Conversation = this.get(conversationId);

    const messageIndex = conversation.messages.findIndex(message => message.id === messageId);
    if (messageIndex === -1)
      throw new Error(`message with id ${messageId} does not exist in conversation ${conversationId}.`);

    // Update the message with the provided content
    conversation.messages[messageIndex] = {
      ...conversation.messages[messageIndex],
      ...message,
      id: messageId, // preventing we are not updating the id
    };
    this.notify();
  }

  async deleteConversation(id: string): Promise<void> {
    const conversation = this.get(id);
    if (conversation.container) {
      await containerEngine.stopContainer(conversation.container?.engineId, conversation.container?.containerId);
    }
    await fs.promises.rm(path.join(this.configurationRegistry.getConversationsPath(), id), {
      recursive: true,
      force: true,
    });
    this.#conversations.delete(id);
    this.notify();
  }

  async createConversation(name: string, modelId: string): Promise<string> {
    const conversationId = this.getUniqueId();
    const conversationFolder = path.join(this.configurationRegistry.getConversationsPath(), conversationId);
    await fs.promises.mkdir(conversationFolder, {
      recursive: true,
    });
    //WARNING: this will not work in production mode but didn't find how to embed binary assets
    //this code get an initialized database so that default user is not admin thus did not get the initial
    //welcome modal dialog
    await fs.promises.copyFile(
      path.join(__dirname, '..', 'src', 'assets', 'webui.db'),
      path.join(conversationFolder, 'webui.db'),
    );
    this.#conversations.set(conversationId, {
      name: name,
      modelId: modelId,
      messages: [],
      id: conversationId,
    });
    this.notify();
    return conversationId;
  }

  async startConversationContainer(server: InferenceServer, trackingId: string, conversationId: string): Promise<void> {
    const conversation = this.get(conversationId);
    const port = await getFreeRandomPort('127.0.0.1');
    const connection = await this.podmanConnection.getConnectionByEngineId(server.container.engineId);
    await this.pullImage(connection, 'ghcr.io/open-webui/open-webui:main', {
      trackingId: trackingId,
    });
    const inferenceServerContainer = await containerEngine.inspectContainer(
      server.container.engineId,
      server.container.containerId,
    );
    const options: ContainerCreateOptions = {
      Env: [
        'DEFAULT_LOCALE=en-US',
        'WEBUI_AUTH=false',
        'ENABLE_OLLAMA_API=false',
        `OPENAI_API_BASE_URL=http://${inferenceServerContainer.NetworkSettings.IPAddress}:8000/v1`,
        'OPENAI_API_KEY=sk_dummy',
        `WEBUI_URL=http://localhost:${port}`,
        `DEFAULT_MODELS=/models/${server.models[0].file?.file}`,
      ],
      Image: 'ghcr.io/open-webui/open-webui:main',
      HostConfig: {
        AutoRemove: true,
        Mounts: [
          {
            Source: path.join(this.configurationRegistry.getConversationsPath(), conversationId),
            Target: '/app/backend/data',
            Type: 'bind',
          },
        ],
        PortBindings: {
          '8080/tcp': [
            {
              HostPort: `${port}`,
            },
          ],
        },
        SecurityOpt: [DISABLE_SELINUX_LABEL_SECURITY_OPTION],
      },
    };
    const c = await containerEngine.createContainer(server.container.engineId, options);
    conversation.container = { engineId: c.engineId, containerId: c.id, port };
  }

  protected pullImage(
    connection: ContainerProviderConnection,
    image: string,
    labels: { [id: string]: string },
  ): Promise<ImageInfo> {
    // Creating a task to follow pulling progress
    const pullingTask = this.taskRegistry.createTask(`Pulling ${image}.`, 'loading', labels);

    // get the default image info for this provider
    return getImageInfo(connection, image, (_event: PullEvent) => {})
      .catch((err: unknown) => {
        pullingTask.state = 'error';
        pullingTask.progress = undefined;
        pullingTask.error = `Something went wrong while pulling ${image}: ${String(err)}`;
        throw err;
      })
      .then(imageInfo => {
        pullingTask.state = 'success';
        pullingTask.progress = undefined;
        return imageInfo;
      })
      .finally(() => {
        this.taskRegistry.updateTask(pullingTask);
      });
  }

  /**
   * This method will be responsible for finalizing the message by concatenating all the choices
   * @param conversationId
   * @param messageId
   */
  completeMessage(conversationId: string, messageId: string): void {
    const conversation: Conversation = this.get(conversationId);

    const messageIndex = conversation.messages.findIndex(message => message.id === messageId);
    if (messageIndex === -1)
      throw new Error(`message with id ${messageId} does not exist in conversation ${conversationId}.`);

    const content = ((conversation.messages[messageIndex] as PendingChat)?.choices || [])
      .map(choice => choice.content)
      .join('');

    this.update(conversationId, messageId, {
      ...conversation.messages[messageIndex],
      choices: undefined,
      role: 'assistant',
      completed: Date.now(),
      content: content,
    } as AssistantChat);
  }

  /**
   * Utility method to quickly add a choice to a given a message inside a conversation
   * @param conversationId
   * @param messageId
   * @param choice
   */
  appendChoice(conversationId: string, messageId: string, choice: Choice): void {
    const conversation: Conversation = this.get(conversationId);

    const messageIndex = conversation.messages.findIndex(message => message.id === messageId);
    if (messageIndex === -1)
      throw new Error(`message with id ${messageId} does not exist in conversation ${conversationId}.`);

    this.update(conversationId, messageId, {
      ...conversation.messages[messageIndex],
      choices: [...((conversation.messages[messageIndex] as PendingChat)?.choices || []), choice],
    } as PendingChat);
  }

  /**
   * Utility method to add a new Message to a given conversation
   * @param conversationId
   * @param message
   */
  submit(conversationId: string, message: Message): void {
    const conversation = this.#conversations.get(conversationId);
    if (conversation === undefined) throw new Error(`conversation with id ${conversationId} does not exist.`);

    this.#conversations.set(conversationId, {
      ...conversation,
      messages: [...conversation.messages, message],
    });
    this.notify();
  }

  dispose(): void {
    this.#conversations.clear();
  }

  get(conversationId: string): Conversation {
    const conversation: Conversation | undefined = this.#conversations.get(conversationId);
    if (conversation === undefined) throw new Error(`conversation with id ${conversationId} does not exist.`);
    return conversation;
  }

  getAll(): Conversation[] {
    return Array.from(this.#conversations.values());
  }
}
