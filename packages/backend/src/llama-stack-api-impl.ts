/**********************************************************************
 * Copyright (C) 2025 Red Hat, Inc.
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

import { navigation } from '@podman-desktop/api';
import type { LlamaStackAPI } from '@shared/LlamaStackAPI';
import type { LlamaStackContainerConfiguration } from '@shared/models/llama-stack/LlamaStackContainerConfiguration';
import type { LlamaStackManager } from './managers/llama-stack/llamaStackManager';
import type { LlamaStackContainerInfo } from '@shared/models/llama-stack/LlamaStackContainerInfo';

export class LlamaStackApiImpl implements LlamaStackAPI {
  constructor(private llamaStackManager: LlamaStackManager) {}

  requestCreateLlamaStackContainer(config: LlamaStackContainerConfiguration): Promise<void> {
    return this.llamaStackManager.requestCreateLlamaStackContainer(config);
  }

  routeToLlamaStackContainerTerminal(containerId: string): Promise<void> {
    return navigation.navigateToContainerTerminal(containerId);
  }

  getLlamaStackContainerInfo(): Promise<LlamaStackContainerInfo | undefined> {
    return this.llamaStackManager.getLlamaStackContainer();
  }
}
