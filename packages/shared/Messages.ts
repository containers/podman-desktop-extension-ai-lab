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

export enum Messages {
  /**
   * @deprecated
   */
  MSG_PLAYGROUNDS_STATE_UPDATE = 'playgrounds-state-update',
  /**
   * @deprecated
   */
  MSG_NEW_PLAYGROUND_QUERIES_STATE = 'new-playground-queries-state',
  MSG_PLAYGROUNDS_MESSAGES_UPDATE = 'playgrounds-messages-update',
  MSG_NEW_CATALOG_STATE = 'new-catalog-state',
  MSG_TASKS_UPDATE = 'tasks-update',
  MSG_NEW_MODELS_STATE = 'new-models-state',
  MSG_APPLICATIONS_STATE_UPDATE = 'applications-state-update',
  MSG_LOCAL_REPOSITORY_UPDATE = 'local-repository-update',
  MSG_INFERENCE_SERVERS_UPDATE = 'inference-servers-update',
  MSG_MONITORING_UPDATE = 'monitoring-update',
  MSG_SUPPORTED_LANGUAGES_UPDATE = 'supported-languages-supported',
  MSG_CONVERSATIONS_UPDATE = 'conversations-update',
  MSG_PLAYGROUNDS_V2_UPDATE = 'playgrounds-v2-update',
}
