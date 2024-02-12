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
import { existsSync, promises } from 'node:fs';
import defaultCatalog from '../ai.json';
import type { Category } from '@shared/src/models/ICategory';
import type { Recipe } from '@shared/src/models/IRecipe';
import type { ModelInfo } from '@shared/src/models/IModelInfo';
import { MSG_NEW_CATALOG_STATE } from '@shared/Messages';
import { fs } from '@podman-desktop/api';
import type { Webview } from '@podman-desktop/api';

export class CatalogManager {
  private catalog: Catalog;

  constructor(
    private appUserDirectory: string,
    private webview: Webview,
  ) {
    // We start with an empty catalog, for the methods to work before the catalog is loaded
    this.catalog = {
      categories: [],
      models: [],
      recipes: [],
    };
  }

  public getCatalog(): Catalog {
    return this.catalog;
  }

  public getCategories(): Category[] {
    return this.catalog.categories;
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

  async loadCatalog() {
    const catalogPath = path.resolve(this.appUserDirectory, 'catalog.json');

    try {
      this.watchCatalogFile(catalogPath); // do not await, we want to do this async
    } catch (err: unknown) {
      console.error(`unable to watch catalog file, changes to the catalog file won't be reflected to the UI`, err);
    }

    if (!existsSync(catalogPath)) {
      return this.setCatalog(defaultCatalog);
    }

    try {
      const cat = await this.readAndAnalyzeCatalog(catalogPath);
      return this.setCatalog(cat);
    } catch (err: unknown) {
      console.error('unable to read catalog file, reverting to default catalog', err);
    }
    // If something went wrong we load the default catalog
    return this.setCatalog(defaultCatalog);
  }

  watchCatalogFile(path: string) {
    const watcher = fs.createFileSystemWatcher(path);
    watcher.onDidCreate(async () => {
      try {
        const cat = await this.readAndAnalyzeCatalog(path);
        await this.setCatalog(cat);
      } catch (err: unknown) {
        console.error('unable to read created catalog file, continue using default catalog', err);
      }
    });
    watcher.onDidDelete(async () => {
      console.log('user catalog file deleted, reverting to default catalog');
      await this.setCatalog(defaultCatalog);
    });
    watcher.onDidChange(async () => {
      try {
        const cat = await this.readAndAnalyzeCatalog(path);
        await this.setCatalog(cat);
      } catch (err: unknown) {
        console.error('unable to read modified catalog file, reverting to default catalog', err);
      }
    });
  }

  async readAndAnalyzeCatalog(path: string): Promise<Catalog> {
    const data = await promises.readFile(path, 'utf-8');
    return JSON.parse(data) as Catalog;
    // TODO(feloy): check version, ...
  }

  async setCatalog(newCatalog: Catalog) {
    this.catalog = newCatalog;
    await this.webview.postMessage({
      id: MSG_NEW_CATALOG_STATE,
      body: this.catalog,
    });
  }
}
