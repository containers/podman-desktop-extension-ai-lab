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
  PendingChat,
} from '@shared/src/models/IPlaygroundMessage';
import type { Disposable, Webview } from '@podman-desktop/api';
import { Messages } from '@shared/Messages';

export class ConversationRegistry extends Publisher<Conversation[]> implements Disposable {
  #conversations: Map<string, Conversation>;
  #scheduledSave: ReturnType<typeof setTimeout> | undefined;

  constructor(webview: Webview) {
    super(webview, Messages.MSG_CONVERSATIONS_UPDATE, () => this.getAll());
    this.#conversations = new Map<string, Conversation>();
    this.#scheduledSave = undefined;
  }

  init(): void {
    // TODO: load from file
  }

  /**
   * Utility method to update a message content in a given conversation
   * @param conversationId
   * @param messageId
   * @param message
   */
  update(conversationId: string, messageId: string, message: Partial<ChatMessage>) {
    const conversation = this.#conversations.get(conversationId);

    if(conversation === undefined) {
      throw new Error(`conversation with id ${conversationId} does not exist.`);
    }

    const messageIndex = conversation.messages.findIndex((message) => message.id === messageId);
    if(messageIndex === -1)
      throw new Error(`message with id ${messageId} does not exist in conversation ${conversationId}.`);

    // Update the message with the provided content
    conversation.messages[messageIndex] = {
      ...conversation.messages[messageIndex],
      ...message,
      id: messageId, // preventing we are not updating the id
    };
    this.notify();
  }

  /**
   * This method will be responsible for finalizing the message by concatenating all the choices
   * @param conversationId
   * @param messageId
   */
  completeMessage(conversationId: string, messageId: string): void {
    const conversation = this.#conversations.get(conversationId);
    if(conversation === undefined)
      throw new Error(`conversation with id ${conversationId} does not exist.`);

    const messageIndex = conversation.messages.findIndex((message) => message.id === messageId);
    if(messageIndex === -1)
      throw new Error(`message with id ${messageId} does not exist in conversation ${conversationId}.`);

    const content = ((conversation.messages[messageIndex] as PendingChat)?.choices || []).map(choice => choice.content).join('');

    this.update(conversationId, messageId, {
      ...conversation.messages[messageIndex],
      choices: undefined,
      role: 'assistant',
      completed: true,
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
    const conversation = this.#conversations.get(conversationId);
    if(conversation === undefined)
      throw new Error(`conversation with id ${conversationId} does not exist.`);

    const messageIndex = conversation.messages.findIndex((message) => message.id === messageId);
    if(messageIndex === -1)
      throw new Error(`message with id ${messageId} does not exist in conversation ${conversationId}.`);

    this.update(conversationId, messageId, {
      ...conversation.messages[messageIndex],
      choices: [
        ...((conversation.messages[messageIndex] as PendingChat)?.choices || []),
        choice,
      ],
    } as PendingChat);
  }

  /**
   * Utility method to add a new Message to a given conversation
   * @param conversationId
   * @param message
   */
  submit(conversationId: string, message: ChatMessage): void {
    if(this.#conversations.has(conversationId)) {
      throw new Error('Trying to submit a message to a non-existing conversation.');
    }

    const conversation = this.#conversations.get(conversationId);
    this.#conversations.set(conversationId, {
      ...conversation,
      messages: [...conversation.messages, message],
    });
    this.scheduleSave();
  }

  private scheduleSave(): void {
    if(this.#scheduledSave !== undefined)
      return;
    this.#scheduledSave = setTimeout(() => {
      this.save().catch((err: unknown) => {
        console.error('Something went wrong while trying to save', err);
      });
      this.#scheduledSave = undefined;
    }, 1000 * 60);
  }

  private async save(): Promise<void> {
    // TODO: save to local filesystem
  }

  dispose(): void {
    // If we have a save scheduled it mean that we need to save.
    if(this.#scheduledSave) {
      clearTimeout(this.#scheduledSave);
      this.save().catch((err: unknown) => {
        console.error('Something went wrong while trying to save', err);
      }).finally(() => {
        this.#conversations.clear();
      });
    } else {
      this.#conversations.clear();
    }
  }

  get(conversationId: string): Conversation | undefined {
    return this.#conversations.get(conversationId);
  }

  getAll(): Conversation[] {
    return Array.from(this.#conversations.values());
  }
}
