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
import { JsonWatcher } from '../../utils/JsonWatcher';
import path from 'node:path';
import defaultModels from '../../assets/models-catalog.json';

export class ModelCatalog extends Publisher<ModelInfo[]> implements Disposable {
  #models: Map<string, ModelInfo>;
  #disposables: Disposable[];

  constructor(
    webview: Webview,
    private appUserDirectory: string,
  ) {
    super(webview, MESSAGES.UPDATE_MODEL_CATALOG, () => this.getModels());
    this.#models = new Map<string, ModelInfo>();
    this.#disposables = [];
  }

  init(): void {
    // Creating a json watcher
    const jsonWatcher: JsonWatcher<ModelInfo[]> = new JsonWatcher(
      path.resolve(this.appUserDirectory, 'models-catalog.json'),
      defaultModels,
    );
    jsonWatcher.onContentUpdated(content => this.onModelCatalogUpdate(content));
    jsonWatcher.init();

    this.#disposables.push(jsonWatcher);
  }

  private onModelCatalogUpdate(models: ModelInfo[]): void {
    this.#models = new Map(models.map((model) => [model.id, model]));
    this.notify();
  }

  dispose(): void {
    this.#models.clear();
    this.#disposables.forEach(watcher => watcher.dispose());
  }

  getModels(): ModelInfo[] {
    return Array.from(this.#models.values());
  }
}
