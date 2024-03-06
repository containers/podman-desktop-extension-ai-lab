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

import type { Catalog } from '@shared/src/models/ICatalog';
import path from 'node:path';
import defaultCatalog from '../ai.json';
import type { Recipe } from '@shared/src/models/IRecipe';
import type { ModelInfo } from '@shared/src/models/IModelInfo';
import { MSG_NEW_CATALOG_STATE } from '@shared/Messages';
import { type Disposable, type Webview, fs } from '@podman-desktop/api';
import { JsonWatcher } from '../utils/JsonWatcher';
import { Publisher } from '../utils/Publisher';

export class CatalogManager extends Publisher<Catalog> implements Disposable {
  private catalog: Catalog;
  #disposables: Disposable[];

  constructor(
    webview: Webview,
    private appUserDirectory: string,
  ) {
    super(webview, MSG_NEW_CATALOG_STATE, () => this.getCatalog());
    // We start with an empty catalog, for the methods to work before the catalog is loaded
    this.catalog = {
      categories: [],
      models: [],
      recipes: [],
    };

    this.#disposables = [];
  }

  init(): void {
    // Creating a json watcher
    const jsonWatcher: JsonWatcher<Catalog> = new JsonWatcher(
      path.resolve(this.appUserDirectory, 'catalog.json'),
      defaultCatalog
    )
    jsonWatcher.onContentUpdated((content) => this.onCatalogUpdated(content));
    jsonWatcher.init();

    this.#disposables.push(jsonWatcher);
  }

  private onCatalogUpdated(content: Catalog): void {
    this.catalog = content;
    this.notify();
  }

  dispose(): void {
    this.#disposables.forEach(watcher => watcher.dispose());
  }

  public getCatalog(): Catalog {
    return this.catalog;
  }

  public getModels(): ModelInfo[] {
    return this.catalog.models;
  }

  public getModelById(modelId: string): ModelInfo {
    const model = this.getModels().find(m => modelId === m.id);
    if (!model) {
      throw new Error(`No model found having id ${modelId}`);
    }
    return model;
  }

  public getRecipes(): Recipe[] {
    return this.catalog.recipes;
  }

  public getRecipeById(recipeId: string): Recipe {
    const recipe = this.getRecipes().find(r => recipeId === r.id);
    if (!recipe) {
      throw new Error(`No recipe found having id ${recipeId}`);
    }
    return recipe;
  }
}
