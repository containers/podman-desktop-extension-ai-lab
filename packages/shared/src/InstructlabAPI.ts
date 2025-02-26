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

import { createRpcChannel } from './messages/MessageProxy';
import type { InstructlabSession } from './models/instructlab/IInstructlabSession';
import type { InstructlabContainerConfiguration } from './models/instructlab/IInstructlabContainerConfiguration';

export const INSTRUCTLAB_API_CHANNEL = createRpcChannel<InstructlabAPI>('InstructlabAPI');
export interface InstructlabAPI {
  /**
   * Get sessions of InstructLab tuning
   */
  getIsntructlabSessions(): Promise<InstructlabSession[]>;

  /**
   * Start a container for InstructLab
   *
   * @param config
   */
  requestCreateInstructlabContainer(config: InstructlabContainerConfiguration): Promise<void>;

  routeToInstructLabContainerTerminal(containerId: string): Promise<void>;

  getInstructlabContainerId(): Promise<string | undefined>;
}
