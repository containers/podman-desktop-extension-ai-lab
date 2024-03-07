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
import type { ModelInfo } from '@shared/src/models/IModelInfo';
import { Publisher } from '../../utils/Publisher';
import { MESSAGES } from '@shared/Messages';
import type { Disposable, Webview } from '@podman-desktop/api';

export class ModelCatalog extends Publisher<ModelInfo[]> implements Disposable {
  #models: Map<string, ModelInfo>;

  constructor(
    webview: Webview,
    private appUserDirectory: string,
  ) {
    super(webview, MESSAGES.UPDATE_MODEL_CATALOG, () => this.getModels());
    this.#models = new Map<string, ModelInfo>();
  }

  dispose(): void {
    this.#models.clear();
  }

  getModels(): ModelInfo[] {
    return Array.from(this.#models.values());
  }
}
