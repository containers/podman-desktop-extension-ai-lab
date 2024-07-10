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

import type { ModelOptions } from './IModelOptions';

export interface Message {
  id: string;
  timestamp: number;
}

export interface ErrorMessage extends Message {
  error: string;
}

export interface ChatMessage extends Message {
  role: 'system' | 'user' | 'assistant';
  content?: string;
}

export interface AssistantChat extends ChatMessage {
  role: 'assistant';
  completed?: number;
}

export interface SystemPrompt extends ChatMessage {
  role: 'system';
  content: string;
}

export interface PendingChat extends AssistantChat {
  completed: undefined;
  choices: Choice[];
}

export interface UserChat extends ChatMessage {
  role: 'user';
  options?: ModelOptions;
}

export interface Conversation {
  id: string;
  messages: Message[];
  modelId: string;
  name: string;
}

export interface Choice {
  content: string;
}

export function isErrorMessage(msg: Message): msg is ErrorMessage {
  return 'error' in msg;
}

export function isChatMessage(msg: Message): msg is ChatMessage {
  return 'role' in msg;
}

export function isAssistantChat(msg: Message): msg is AssistantChat {
  return isChatMessage(msg) && msg.role === 'assistant';
}

export function isUserChat(msg: Message): msg is UserChat {
  return isChatMessage(msg) && msg.role === 'user';
}

export function isPendingChat(msg: Message): msg is PendingChat {
  return isAssistantChat(msg) && !msg.completed;
}

export function isSystemPrompt(msg: Message): msg is SystemPrompt {
  return isChatMessage(msg) && msg.role === 'system';
}
