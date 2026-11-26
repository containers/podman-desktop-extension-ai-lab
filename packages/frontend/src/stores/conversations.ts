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
import type { InferenceServer, InferenceType } from '@shared/models/IInference';
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
  Promise.all([studioClient.getModelsInfo(), studioClient.getInferenceServers()])
    .then(([modelsInfo, servers]) => {
      const conversationsWithBackend: ConversationWithBackend[] = conversations.map(conversation => ({
        ...conversation,
        backend: getModelBackend(modelsInfo, servers, conversation.modelId),
      }));
      set(conversationsWithBackend);
    })
    .catch((err: unknown) => {
      console.error('error getting models info', String(err));
    });
}

// a model may support several backends: use the one of the inference server serving the model,
// or the preferred backend of the model
function getModelBackend(modelsInfo: ModelInfo[], servers: InferenceServer[], modelId: string): InferenceType {
  const server = servers.find(server => server.models.some(model => model.id === modelId));
  if (server) return server.type;
  const backend = modelsInfo.find(modelInfo => modelInfo.id === modelId)?.backends?.[0];
  return toInferenceType(backend);
}
