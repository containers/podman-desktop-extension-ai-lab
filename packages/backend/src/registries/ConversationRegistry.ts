/**********************************************************************
 * Copyright (C) 2024-2025 Red Hat, Inc.
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
  Conversation,
  Message,
  ModelUsage,
  ToolCall,
} from '@shared/models/IPlaygroundMessage';
import type { Disposable } from '@podman-desktop/api';
import { MSG_CONVERSATIONS_UPDATE } from '@shared/Messages';
import type { RpcExtension } from '@shared/messages/MessageProxy';

export class ConversationRegistry extends Publisher<Conversation[]> implements Disposable {
  #conversations: Map<string, Conversation>;
  #counter: number;

  constructor(rpcExtension: RpcExtension) {
    super(rpcExtension, MSG_CONVERSATIONS_UPDATE, () => this.getAll());
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

  deleteConversation(id: string): void {
    this.#conversations.delete(id);
    this.notify();
  }

  createConversation(name: string, modelId: string): string {
    const conversationId = this.getUniqueId();
    this.#conversations.set(conversationId, {
      name: name,
      modelId: modelId,
      messages: [],
      id: conversationId,
      usage: {
        completion_tokens: 0,
        prompt_tokens: 0,
      } as ModelUsage,
    });
    this.notify();
    return conversationId;
  }

  /**
   * This method will be responsible for finalizing the message
   * @param conversationId
   * @param messageId
   */
  completeMessage(conversationId: string, messageId: string): void {
    const conversation: Conversation = this.get(conversationId);

    const messageIndex = conversation.messages.findIndex(message => message.id === messageId);
    if (messageIndex === -1)
      throw new Error(`message with id ${messageId} does not exist in conversation ${conversationId}.`);

    this.update(conversationId, messageId, {
      ...conversation.messages[messageIndex],
      choices: undefined,
      role: 'assistant',
      completed: Date.now(),
    } as AssistantChat);
  }

  /**
   * Utility method to quickly add a usage to a conversation
   * @param conversationId
   * @param usage
   */
  setUsage(conversationId: string, usage: ModelUsage): void {
    const conversation: Conversation = this.get(conversationId);
    if (!usage) {
      return;
    }
    this.#conversations.set(conversationId, {
      ...conversation,
      usage,
    });
    this.notify();
  }

  /**
   * Utility method to quickly add a delta to a given a message inside a conversation
   * @param conversationId
   * @param messageId
   * @param delta
   */
  textDelta(conversationId: string, messageId: string, delta: string): void {
    const conversation: Conversation = this.get(conversationId);
    const messageIndex = conversation.messages.findIndex(message => message.id === messageId);
    if (messageIndex === -1) {
      throw new Error(`message with id ${messageId} does not exist in conversation ${conversationId}.`);
    }
    this.update(conversationId, messageId, {
      ...conversation.messages[messageIndex],
      content: ((conversation.messages[messageIndex] as AssistantChat).content ?? '') + delta,
    } as AssistantChat);
  }

  /**
   *
   */
  toolResult(conversationId: string, toolCallId: string, toolResult: string | object): void {
    const conversation: Conversation = this.get(conversationId);
    const messageIndex = conversation.messages.findIndex(
      message =>
        (message as ChatMessage)?.role === 'assistant' &&
        ((message as AssistantChat).content as ToolCall)?.type === 'tool-call' &&
        ((message as AssistantChat).content as ToolCall)?.toolCallId === toolCallId,
    );
    if (messageIndex === -1) {
      throw new Error(`message with for tool call ${toolCallId} does not exist in conversation ${conversationId}.`);
    }
    const content: ToolCall = {
      ...((conversation.messages[messageIndex] as AssistantChat).content as ToolCall),
      result: toolResult,
    };
    this.update(conversationId, conversation.messages[messageIndex].id, {
      ...conversation.messages[messageIndex],
      completed: Date.now(),
      content,
    } as AssistantChat);
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
