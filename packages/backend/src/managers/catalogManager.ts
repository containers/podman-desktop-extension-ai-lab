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

import type { ApplicationCatalog } from '@shared/src/models/IApplicationCatalog';
import { promises } from 'node:fs';
import path from 'node:path';
import defaultCatalog from '../assets/ai.json';
import type { Recipe } from '@shared/src/models/IRecipe';
import type { ModelInfo } from '@shared/src/models/IModelInfo';
import { Messages } from '@shared/Messages';
import { Disposable, type Webview } from '@podman-desktop/api';
import { JsonWatcher } from '../utils/JsonWatcher';
import { Publisher } from '../utils/Publisher';
import type { LocalModelImportInfo } from '@shared/src/models/ILocalModelInfo';

export type catalogUpdateHandle = () => void;

export class CatalogManager extends Publisher<ApplicationCatalog> implements Disposable {
  private catalog: ApplicationCatalog;
  #catalogUpdateListeners: catalogUpdateHandle[];
  #disposables: Disposable[];

  constructor(
    webview: Webview,
    private appUserDirectory: string,
  ) {
    super(webview, Messages.MSG_NEW_CATALOG_STATE, () => this.getCatalog());
    // We start with an empty catalog, for the methods to work before the catalog is loaded
    this.catalog = {
      categories: [],
      models: [],
      recipes: [],
    };

    this.#catalogUpdateListeners = [];
    this.#disposables = [];
  }

  init(): void {
    // Creating a json watcher
    const jsonWatcher: JsonWatcher<ApplicationCatalog> = new JsonWatcher(
      path.resolve(this.appUserDirectory, 'catalog.json'),
      defaultCatalog,
    );
    jsonWatcher.onContentUpdated(content => this.onCatalogUpdated(content));
    jsonWatcher.init();

    this.#disposables.push(jsonWatcher);
  }

  private onCatalogUpdated(content: ApplicationCatalog): void {
    this.catalog = content;
    this.#catalogUpdateListeners.forEach(listener => listener());
    this.notify();
  }

  onCatalogUpdate(listener: catalogUpdateHandle): Disposable {
    this.#catalogUpdateListeners.push(listener);
    return Disposable.create(() => {
      this.#catalogUpdateListeners.splice(this.#catalogUpdateListeners.indexOf(listener), 1);
    });
  }

  dispose(): void {
    this.#disposables.forEach(watcher => watcher.dispose());
  }

  public getCatalog(): ApplicationCatalog {
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

  async addLocalModelsToCatalog(models: LocalModelImportInfo[]): Promise<void> {
    // we copy the current catalog in another object and update it with the model
    // then write it to the custom catalog path. If it exists it will be overwritten by default
    const tmpCatalog: ApplicationCatalog = Object.assign({}, this.catalog);

    for (const model of models) {
      const statFile = await promises.stat(model.path);
      tmpCatalog.models.push({
        id: model.path,
        name: model.name,
        description: `Model imported from ${model.path}`,
        hw: 'CPU',
        file: {
          path: path.dirname(model.path),
          file: path.basename(model.path),
        },
        memory: statFile.size,
      });
    }

    const customCatalog = path.resolve(this.appUserDirectory, 'catalog.json');
    return promises.writeFile(customCatalog, JSON.stringify(tmpCatalog, undefined, 2), 'utf-8');
  }

  async removeLocalModelFromCatalog(modelId: string): Promise<void> {
    // we copy the current catalog in another object and remove from it the model with modelId
    // then write it to the custom catalog path.
    const tmpCatalog: ApplicationCatalog = Object.assign({}, this.catalog);
    tmpCatalog.models = tmpCatalog.models.filter(m => m.url !== '' && m.id !== modelId);

    const customCatalog = path.resolve(this.appUserDirectory, 'catalog.json');
    return promises.writeFile(customCatalog, JSON.stringify(tmpCatalog, undefined, 2), 'utf-8');
  }
}
