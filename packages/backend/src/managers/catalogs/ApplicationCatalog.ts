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
import type { Recipe } from '@shared/src/models/IRecipe';
import type { Disposable, Webview } from '@podman-desktop/api';
import { MESSAGES } from '@shared/Messages';
import { Publisher } from '../../utils/Publisher';
import { JsonWatcher } from '../../utils/JsonWatcher';
import path from 'node:path';
import defaultApplications from '../../assets/applications-catalog.json';

export class ApplicationCatalog extends Publisher<Recipe[]> implements Disposable {
  #applications: Map<string, Recipe>;
  #disposables: Disposable[];

  constructor(
    webview: Webview,
    private appUserDirectory: string,
  ) {
    super(webview, MESSAGES.UPDATE_APP_CATALOG, () => this.getApplications());
    this.#applications = new Map<string, Recipe>();
    this.#disposables = [];
  }

  init(): void {
    // Creating a json watcher
    const jsonWatcher: JsonWatcher<Recipe[]> = new JsonWatcher(
      path.resolve(this.appUserDirectory, 'applications-catalog.json'),
      defaultApplications,
    );
    jsonWatcher.onContentUpdated(content => this.onApplicationCatalogUpdate(content));
    jsonWatcher.init();

    this.#disposables.push(jsonWatcher);
  }

  private onApplicationCatalogUpdate(applications: Recipe[]): void {
    this.#applications = new Map(applications.map((app) => [app.id, app]));
    this.notify();
  }

  dispose(): void {
    this.#applications.clear();
  }

  getApplications(): Recipe[] {
    return Array.from(this.#applications.values());
  }
}
