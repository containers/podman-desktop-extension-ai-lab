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

import type { RecipeModelIndex } from '@shared/src/models/IRecipeModelIndex';

export class ApplicationRegistry<T extends RecipeModelIndex> {
  #applications = new Map<string, T>();

  keys(): RecipeModelIndex[] {
    return Array.from(this.#applications.values()).map(a => ({ recipeId: a.recipeId, modelId: a.modelId }));
  }

  has(recipeModel: RecipeModelIndex): boolean {
    return this.#applications.has(this.hash(recipeModel));
  }

  delete(recipeModel: RecipeModelIndex): boolean {
    return this.#applications.delete(this.hash(recipeModel));
  }

  values(): IterableIterator<T> {
    return this.#applications.values();
  }

  get(recipeModel: RecipeModelIndex): T {
    const application = this.#applications.get(this.hash(recipeModel));
    if (!application) throw new Error('application not found.');
    return application;
  }

  set(recipeModel: RecipeModelIndex, value: T): void {
    this.#applications.set(this.hash(recipeModel), value);
  }

  clear() {
    this.#applications.clear();
  }

  private hash(recipeModel: RecipeModelIndex): string {
    return recipeModel.recipeId + recipeModel.modelId;
  }
}
