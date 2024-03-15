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

export interface ChatMessage {
  id: string;
  role: 'system' | 'user' | 'assistant';
  content?: string;
  timestamp: number;
}

export interface AssistantChat extends ChatMessage {
  role: 'assistant';
  completed: boolean
}

export interface PendingChat extends AssistantChat {
  completed: false;
  choices: Choice[];
}

export interface UserChat extends ChatMessage {
  role: 'user',
  options?: ModelOptions,
}

export interface Conversation {
  id: string;
  messages: ChatMessage[];
}

export interface Choice {
  content: string;
}
