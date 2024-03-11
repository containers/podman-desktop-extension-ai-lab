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
import type { Category } from '@shared/src/models/ICategory';
import { Publisher } from '../../utils/Publisher';
import { MESSAGES } from '@shared/Messages';
import type { Disposable, Webview } from '@podman-desktop/api';
import { JsonWatcher } from '../../utils/JsonWatcher';
import path from 'node:path';
import defaultCategories from '../../assets/categories-catalog.json';

export class CategoryCatalog extends Publisher<Category[]> implements Disposable {
  #categories: Map<string, Category>;
  #disposables: Disposable[];

  constructor(
    webview: Webview,
    private appUserDirectory: string,
  ) {
    super(webview, MESSAGES.UPDATE_CATEGORY_CATALOG, () => this.getCategories());
    this.#categories = new Map<string, Category>();
    this.#disposables = [];
  }

  init(): void {
    // Creating a json watcher
    const jsonWatcher: JsonWatcher<Category[]> = new JsonWatcher(
      path.resolve(this.appUserDirectory, 'categories-catalog.json'),
      defaultCategories,
    );
    jsonWatcher.onContentUpdated(content => this.onCategoryCatalogUpdate(content));
    jsonWatcher.init();

    this.#disposables.push(jsonWatcher);
  }

  private onCategoryCatalogUpdate(categories: Category[]): void {
    this.#categories = new Map(categories.map(category => [category.id, category]));
    this.notify();
  }

  dispose(): void {
    this.#categories.clear();
    this.#disposables.forEach(watcher => watcher.dispose());
  }

  getCategories(): Category[] {
    return Array.from(this.#categories.values());
  }
}
