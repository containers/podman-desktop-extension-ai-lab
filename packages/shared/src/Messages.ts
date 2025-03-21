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
import { createRpcChannel } from './messages/MessageProxy';
import type { Task } from './models/ITask';
import type { ModelInfo } from './models/IModelInfo';
import type { ContainerProviderConnectionInfo } from './models/IContainerConnectionInfo';
import type { InferenceServer } from './models/IInference';
import type { InstructlabSession } from './models/instructlab/IInstructlabSession';
import type { LocalRepository } from './models/ILocalRepository';
import type { Conversation } from './models/IPlaygroundMessage';
import type { ExtensionConfiguration } from './models/IExtensionConfiguration';
import type { ApplicationCatalog } from './models/IApplicationCatalog';
import type { ApplicationState } from './models/IApplicationState';
import type { IGPUInfo } from './models/IGPUInfo';
import type { StatsHistory } from '../../backend/src/managers/monitoringManager';

export const MSG_TASKS_UPDATE = createRpcChannel<Task[]>('tasks-update');
export const MSG_SUPPORTED_LANGUAGES_UPDATE = createRpcChannel<Language[]>('supported-languages-supported');
export const MSG_NEW_MODELS_STATE = createRpcChannel<ModelInfo[]>('new-models-state');
export const MSG_PODMAN_CONNECTION_UPDATE =
  createRpcChannel<ContainerProviderConnectionInfo[]>('podman-connecting-update');
export const MSG_INFERENCE_SERVERS_UPDATE = createRpcChannel<InferenceServer[]>('inference-servers-update');
export const MSG_INSTRUCTLAB_SESSIONS_UPDATE = createRpcChannel<InstructlabSession[]>('instructlab-sessions-update');
export const MSG_LOCAL_REPOSITORY_UPDATE = createRpcChannel<LocalRepository[]>('local-repository-update');
export const MSG_CONVERSATIONS_UPDATE = createRpcChannel<Conversation[]>('conversations-update');
export const MSG_CONFIGURATION_UPDATE = createRpcChannel<ExtensionConfiguration>('configuration-update');
export const MSG_NEW_CATALOG_STATE = createRpcChannel<ApplicationCatalog>('new-catalog-state');
export const MSG_APPLICATIONS_STATE_UPDATE = createRpcChannel<ApplicationState[]>('applications-state-update');
export const MSG_GPUS_UPDATE = createRpcChannel<IGPUInfo[]>('gpus-update');
export const MSG_MONITORING_UPDATE = createRpcChannel<StatsHistory[]>('monitoring-update');
export const MSG_NAVIGATION_ROUTE_UPDATE = createRpcChannel<string>('navigation-route-update');

// array of model handler names
export const MSG_MODEL_HANDLERS_UPDATE = createRpcChannel<string[]>('model-handlers-update');
// array of provider names
export const MSG_INFERENCE_PROVIDER_UPDATE = createRpcChannel<string[]>('inference-provider-update');
