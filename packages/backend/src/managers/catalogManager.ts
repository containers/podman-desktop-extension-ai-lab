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
import type { Recipe } from '@shared/src/models/IRecipe';
import type { ModelInfo } from '@shared/src/models/IModelInfo';
import type { Category } from '@shared/src/models/ICategory';
import { type Disposable, type Webview } from '@podman-desktop/api';
import { BaseCatalog } from './catalogs/BaseCatalog';
import { MESSAGES } from '@shared/Messages';
import path from 'node:path';
import defaultModels from '../assets/models-catalog.json';
import defaultApplications from '../assets/applications-catalog.json';
import defaultCategories from '../assets/categories-catalog.json';

/**
 * @deprecated
 */
export class CatalogManager implements Disposable {
  #modelCatalog: BaseCatalog<ModelInfo>;
  #applicationCatalog: BaseCatalog<Recipe>;
  #categoryCatalog: BaseCatalog<Category>;

  constructor(webview: Webview, appUserDirectory: string) {
    this.#modelCatalog = new BaseCatalog(
      webview,
      MESSAGES.UPDATE_MODEL_CATALOG,
      path.resolve(appUserDirectory, 'models-catalog.json'),
      defaultModels,
      );
    this.#applicationCatalog = new BaseCatalog(
      webview,
      MESSAGES.UPDATE_APP_CATALOG,
      path.resolve(appUserDirectory, 'applications-catalog.json'),
      defaultApplications,
    );
    this.#categoryCatalog = new BaseCatalog(
      webview,
      MESSAGES.UPDATE_CATEGORY_CATALOG,
      path.resolve(appUserDirectory, 'categories-catalog.json'),
      defaultCategories,
    );
  }

  /**
   * @deprecated
   */
  init(): void {
    this.#modelCatalog.init();
    this.#applicationCatalog.init();
  }

  dispose(): void {
    this.#modelCatalog.dispose();
    this.#applicationCatalog.dispose();
  }

  /**
   * @deprecated
   */
  public getCatalog(): Catalog {
    return {
      recipes: this.#applicationCatalog.getAll(),
      models: this.#modelCatalog.getAll(),
      categories: this.#categoryCatalog.getAll(),
    };
  }

  /**
   * @deprecated
   */
  public getModels(): ModelInfo[] {
    return this.#modelCatalog.getAll();
  }

  /**
   * @deprecated
   */
  public getModelById(modelId: string): ModelInfo {
    const model = this.getModels().find(m => modelId === m.id);
    if (!model) {
      throw new Error(`No model found having id ${modelId}`);
    }
    return model;
  }

  /**
   * @deprecated
   */
  public getRecipes(): Recipe[] {
    return this.#applicationCatalog.getAll();
  }

  /**
   * @deprecated
   */
  public getRecipeById(recipeId: string): Recipe {
    const recipe = this.getRecipes().find(r => recipeId === r.id);
    if (!recipe) {
      throw new Error(`No recipe found having id ${recipeId}`);
    }
    return recipe;
  }
}
