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

import type { Language } from 'postman-code-generators';
import { createRpcChannel } from './src/messages/MessageProxy';
import type { Task } from './src/models/ITask';
import type { ModelInfo } from './src/models/IModelInfo';
import type { ContainerProviderConnectionInfo } from './src/models/IContainerConnectionInfo';
import type { InferenceServer } from './src/models/IInference';
import type { InstructlabSession } from './src/models/instructlab/IInstructlabSession';
import type { LocalRepository } from './src/models/ILocalRepository';

export enum Messages {
  MSG_NEW_CATALOG_STATE = 'new-catalog-state',
  MSG_APPLICATIONS_STATE_UPDATE = 'applications-state-update',
  MSG_MONITORING_UPDATE = 'monitoring-update',
  MSG_CONVERSATIONS_UPDATE = 'conversations-update',
  MSG_GPUS_UPDATE = 'gpus-update',
  MSG_INFERENCE_PROVIDER_UPDATE = 'inference-provider-update',
  MSG_CONFIGURATION_UPDATE = 'configuration-update',
  MSG_NAVIGATION_ROUTE_UPDATE = 'navigation-route-update',
}
export const MSG_TASKS_UPDATE = createRpcChannel<Task[]>('tasks-update');
export const MSG_SUPPORTED_LANGUAGES_UPDATE = createRpcChannel<Language[]>('supported-languages-supported');
export const MSG_NEW_MODELS_STATE = createRpcChannel<ModelInfo[]>('new-models-state');
export const MSG_PODMAN_CONNECTION_UPDATE =
  createRpcChannel<ContainerProviderConnectionInfo[]>('podman-connecting-update');
export const MSG_INFERENCE_SERVERS_UPDATE = createRpcChannel<InferenceServer[]>('inference-servers-update');
export const MSG_INSTRUCTLAB_SESSIONS_UPDATE = createRpcChannel<InstructlabSession[]>('instructlab-sessions-update');
export const MSG_LOCAL_REPOSITORY_UPDATE = createRpcChannel<LocalRepository[]>('local-repository-update');
