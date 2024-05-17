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
import fs, { promises } from 'node:fs';
import path from 'node:path';
import defaultCatalog from '../assets/ai.json';
import type { Recipe } from '@shared/src/models/IRecipe';
import type { ModelInfo } from '@shared/src/models/IModelInfo';
import { Messages } from '@shared/Messages';
import { Disposable, type Webview } from '@podman-desktop/api';
import { JsonWatcher } from '../utils/JsonWatcher';
import { Publisher } from '../utils/Publisher';
import type { LocalModelImportInfo } from '@shared/src/models/ILocalModelInfo';
import { type AIConfig, parseYamlFile } from '../models/AIConfig';
import { goarch } from '../utils/arch';

export type catalogUpdateHandle = () => void;

export const USER_CATALOG = 'user-catalog.json';

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

  /**
   * The init method will start a watcher on the user catalog.json
   */
  init(): void {
    // Creating a json watcher
    const jsonWatcher: JsonWatcher<ApplicationCatalog> = new JsonWatcher(this.getUserCatalogPath(), {
      recipes: [],
      models: [],
      categories: [],
    });
    jsonWatcher.onContentUpdated(content => this.onCatalogUpdated(content));
    jsonWatcher.init();

    this.#disposables.push(jsonWatcher);
  }

  private loadDefaultCatalog(): void {
    this.catalog = defaultCatalog as ApplicationCatalog;
    this.notify();
  }

  private onCatalogUpdated(content: ApplicationCatalog): void {
    if (typeof content !== 'object' || !('models' in content) || typeof content.models !== 'object') {
      this.loadDefaultCatalog();
      return;
    }

    const sanitize = this.sanitize(content);
    this.catalog = {
      models: [
        ...defaultCatalog.models.filter(a => !sanitize.models.some(b => a.id === b.id)),
        ...sanitize.models,
      ] as ModelInfo[],
      recipes: [
        ...defaultCatalog.recipes.filter(a => !sanitize.recipes.some(b => a.id === b.id)),
        ...sanitize.recipes
      ],
      categories: [
        ...defaultCatalog.categories.filter(a => !sanitize.categories.some(b => a.id === b.id)),
        ...sanitize.categories,
      ],
    };

    this.notify();
  }

  private sanitize(content: unknown): ApplicationCatalog {
    const output: ApplicationCatalog = {
      recipes: [],
      models: [],
      categories: [],
    };

    if (!content || typeof content !== 'object') {
      console.warn('malformed application catalog content');
      return output;
    }

    // ensure user's models are properly formatted
    if ('models' in content && typeof content.models === 'object' && Array.isArray(content.models)) {
      output.models = content.models.map(model => {
        // parse the creation date properly
        if (model.file?.creation) {
          return {
            ...model,
            file: {
              ...model.file,
              creation: new Date(model.file.creation),
            },
          };
        }
        return model;
      });
    }

    // ensure user's recipes are properly formatted
    if ('recipes' in content && typeof content.recipes === 'object' && Array.isArray(content.recipes)) {
      output.recipes = content.recipes;
    }

    // ensure user's categories are properly formatted
    if ('categories' in content && typeof content.categories === 'object' && Array.isArray(content.categories)) {
      output.categories = content.categories;
    }

    return output;
  }

  override notify() {
    super.notify();
    this.#catalogUpdateListeners.forEach(listener => listener());
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

  async importLocalRecipe(configFile: string): Promise<void> {
    // Get the base dir of the ai-lab.yaml imported file
    let basedir = path.dirname(configFile);

    // Ensure we are not trying to import an existing recipe
    const exists = this.getRecipes().some(recipe => recipe.basedir === basedir);
    if(exists) {
      throw new Error('Cannot import an existing known recipe.');
    }

    // Let's try to parse the ai-lab.yaml provided
    let aiConfig: AIConfig;
    try {
      aiConfig = parseYamlFile(configFile, goarch());
    } catch (err) {
      console.error('Cannot load configure file.', err);
      throw new Error(`Cannot load configuration file.`);
    }

    // Let's check for a readme.md
    let readme: string | undefined = undefined;
    const readmePath = path.join(basedir, 'README.md');
    if(fs.existsSync(readmePath)) {
      readme = await promises.readFile(readmePath, 'utf-8');
    }

    // Create the recipe from ai-lab content
    const userRecipe: Recipe = {
      id: configFile,
      name: aiConfig.application.name,
      description: aiConfig.application.description ?? 'no description',
      categories: [aiConfig.application.type],
      models: [],
      basedir: path.dirname(configFile),
      readme: readme ?? 'no readme',
    }

    // append the new recipe
    const content: ApplicationCatalog = await this.getUserCatalog();
    content.recipes.push(userRecipe);

    // overwrite the existing catalog
    return this.saveUserCatalog(content);
    // no need to notify as we have a file watcher
  }

  private saveUserCatalog(content: ApplicationCatalog): Promise<void> {
    const userCatalogPath = this.getUserCatalogPath();
    return promises.writeFile(userCatalogPath, JSON.stringify(content, undefined, 2), 'utf-8');
  }

  private async getUserCatalog(): Promise<ApplicationCatalog> {
    const userCatalogPath = this.getUserCatalogPath();

    // check if we already have an existing user's catalog
    if (fs.existsSync(userCatalogPath)) {
      const raw = await promises.readFile(userCatalogPath, 'utf-8');
      return this.sanitize(JSON.parse(raw));
    } else {
      return {
        recipes: [],
        models: [],
        categories: [],
      };
    }
  }

  /**
   * This method is used to imports user's local models.
   * @param localModels the models to imports
   */
  async importUserModels(localModels: LocalModelImportInfo[]): Promise<void> {
    const content: ApplicationCatalog = await this.getUserCatalog();

    // Transform local models into ModelInfo
    const models: ModelInfo[] = await Promise.all(
      localModels.map(async local => {
        const statFile = await promises.stat(local.path);
        return {
          id: local.path,
          name: local.name,
          description: `Model imported from ${local.path}`,
          hw: 'CPU',
          file: {
            path: path.dirname(local.path),
            file: path.basename(local.path),
            size: statFile.size,
            creation: statFile.mtime,
          },
          memory: statFile.size,
        };
      }),
    );

    // Add all our models infos to the user's models catalog
    content.models.push(...models);

    // overwrite the existing catalog
    return this.saveUserCatalog(content);
  }

  /**
   * Remove a model from the user's catalog.
   * @param modelId
   */
  async removeUserModel(modelId: string): Promise<void> {
    const userCatalogPath = this.getUserCatalogPath();
    if (!fs.existsSync(userCatalogPath)) {
      throw new Error('User catalog does not exist.');
    }

    const raw = await promises.readFile(userCatalogPath, 'utf-8');
    const content = this.sanitize(JSON.parse(raw));

    return promises.writeFile(
      userCatalogPath,
      JSON.stringify(
        {
          recipes: content.recipes,
          models: content.models.filter(model => model.id !== modelId),
          categories: content.categories,
        },
        undefined,
        2,
      ),
      'utf-8',
    );
  }

  /**
   * Return the path to the user catalog
   */
  private getUserCatalogPath(): string {
    return path.resolve(this.appUserDirectory, USER_CATALOG);
  }
}
