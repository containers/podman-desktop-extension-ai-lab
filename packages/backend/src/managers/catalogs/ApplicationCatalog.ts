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

export class ApplicationCatalog extends Publisher<Recipe[]> implements Disposable {
  #applications: Map<string, Recipe>;

  constructor(webview: Webview) {
    super(webview, MESSAGES.UPDATE_RECIPE_CATALOG, () => this.getApplications());
    this.#applications = new Map<string, Recipe>();
  }

  dispose(): void {
    this.#applications.clear();
  }

  getApplications(): Recipe[] {
    return Array.from(this.#applications.values());
  }
}
