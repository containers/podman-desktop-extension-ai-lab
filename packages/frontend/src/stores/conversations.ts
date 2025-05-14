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

import type { Readable } from 'svelte/store';
import { readable } from 'svelte/store';
import { MSG_CONVERSATIONS_UPDATE } from '@shared/Messages';
import { rpcBrowser, studioClient } from '/@/utils/client';
import type { Conversation } from '@shared/models/IPlaygroundMessage';
import type { ModelInfo } from '@shared/models/IModelInfo';
import type { InferenceType } from '@shared/models/IInference';
import { toInferenceType } from '@shared/models/IInference';

export interface ConversationWithBackend extends Conversation {
  backend: InferenceType;
}

// RPCReadable cannot be used here, as it is doing some debouncing, and we want
// to get the conversation as soon as the tokens arrive here, instead getting them by packets
export const conversations: Readable<ConversationWithBackend[]> = readable<ConversationWithBackend[]>([], set => {
  const sub = rpcBrowser.subscribe(MSG_CONVERSATIONS_UPDATE, conversations => {
    setWithBackend(set, conversations);
  });
  // Initialize the store manually
  studioClient
    .getPlaygroundConversations()
    .then(state => {
      setWithBackend(set, state);
    })
    .catch((err: unknown) => console.error(`Error getting playground conversations:`, err));
  return () => {
    sub.unsubscribe();
  };
});

function setWithBackend(set: (value: ConversationWithBackend[]) => void, conversations: Conversation[]): void {
  studioClient
    .getModelsInfo()
    .then(modelsInfo => {
      const conversationsWithBackend: ConversationWithBackend[] = conversations.map(conversation => ({
        ...conversation,
        backend: getModelBackend(modelsInfo, conversation.modelId),
      }));
      set(conversationsWithBackend);
    })
    .catch((err: unknown) => {
      console.error('error getting models info', String(err));
    });
}

function getModelBackend(modelsInfo: ModelInfo[], modelId: string): InferenceType {
  const backend = modelsInfo.find(modelInfo => modelInfo.id === modelId)?.backend;
  return toInferenceType(backend);
}
