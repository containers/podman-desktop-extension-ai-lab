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
import type { Recipe } from '@shared/src/models/IRecipe';
import type { ModelInfo } from '@shared/src/models/IModelInfo';
import type { Category } from '@shared/src/models/ICategory';
import type { LocalModelInfo } from '@shared/src/models/ILocalModelInfo';

export enum CatalogFormat {
  CURRENT = '1.0',
  UNKNOWN = 'unknown',
}

export function sanitize(rawObject: object): ApplicationCatalog {
  // if there is no version in the user catalog, we try to adapt it automatically to the CURRENT format
  let raw: object & { version: string };
  if (hasCatalogWrongFormat(rawObject)) {
    raw = adaptToCurrent(rawObject);
  } else {
    raw = rawObject as object & { version: string };
  }

  // ensure version is valid
  if (raw.version !== CatalogFormat.CURRENT) throw new Error('the catalog is using an invalid version');

  return {
    version: raw.version,
    recipes: 'recipes' in raw && Array.isArray(raw.recipes) ? raw.recipes.map(recipe => sanitizeRecipe(recipe)) : [],
    models: 'models' in raw && Array.isArray(raw.models) ? raw.models.map(model => sanitizeModel(model)) : [],
    categories:
      'categories' in raw && Array.isArray(raw.categories)
        ? raw.categories.map(category => sanitizeCategory(category))
        : [],
  };
}

export function hasCatalogWrongFormat(raw: object): boolean {
  return 'recipes' in raw && Array.isArray(raw.recipes) && !!raw.recipes.find(r => 'models' in r);
}

function adaptToCurrent(raw: object): object & { version: string } {
  // for recipes - assume backend is llama-cpp and copy models field as recommended
  if ('recipes' in raw && Array.isArray(raw.recipes)) {
    raw.recipes.forEach(recipe => {
      recipe.backend = recipe.backend ?? 'llama-cpp';
      recipe.recommended = recipe.recommended ?? recipe.models ?? []; // Copy models to recommended if not present
      recipe.models = []; // Clear models to avoid duplication
    });
  }

  // for models - assume backend is llama-cpp
  if ('models' in raw && Array.isArray(raw.models)) {
    raw.models.forEach(model => {
      model.backend = model.backend ?? 'llama-cpp';
    });
  }

  return {
    ...raw,
    version: CatalogFormat.CURRENT,
  };
}

/**
 * This method merge catalog A and B, and let the b overwrite a on conflict
 * @param a
 * @param b
 */
export function merge(a: ApplicationCatalog, b: ApplicationCatalog): ApplicationCatalog {
  if (a.version !== b.version) {
    throw new Error('cannot merge incompatible application catalog format.');
  }

  return {
    version: a.version,
    models: [...a.models.filter(model => !b.models.some(mModel => model.id === mModel.id)), ...b.models] as ModelInfo[],
    recipes: [...a.recipes.filter(recipe => !b.recipes.some(mRecipe => recipe.id === mRecipe.id)), ...b.recipes],
    categories: [
      ...a.categories.filter(category => !b.categories.some(mCategory => category.id === mCategory.id)),
      ...b.categories,
    ],
  };
}

export function isNonNullObject(obj: unknown): obj is object {
  return !!obj && typeof obj === 'object';
}

export function isStringRecord(obj: unknown): obj is Record<string, string> {
  return (
    isNonNullObject(obj) &&
    Object.entries(obj).every(([key, value]) => typeof key === 'string' && typeof value === 'string')
  );
}

export function isStringArray(obj: unknown): obj is Array<string> {
  return Array.isArray(obj) && obj.every(item => typeof item === 'string');
}

export function sanitizeRecipe(recipe: unknown): Recipe {
  if (
    isNonNullObject(recipe) &&
    'id' in recipe &&
    typeof recipe.id === 'string' &&
    'name' in recipe &&
    typeof recipe.name === 'string' &&
    'categories' in recipe &&
    isStringArray(recipe.categories) &&
    'description' in recipe &&
    typeof recipe.description === 'string' &&
    'repository' in recipe &&
    typeof recipe.repository === 'string' &&
    'readme' in recipe &&
    typeof recipe.readme === 'string'
  )
    return {
      // mandatory fields
      id: recipe.id,
      name: recipe.name,
      categories: recipe.categories,
      description: recipe.description,
      repository: recipe.repository,
      readme: recipe.readme,
      // optional fields
      ref: 'ref' in recipe && typeof recipe.ref === 'string' ? recipe.ref : undefined,
      icon: 'icon' in recipe && typeof recipe.icon === 'string' ? recipe.icon : undefined,
      basedir: 'basedir' in recipe && typeof recipe.basedir === 'string' ? recipe.basedir : undefined,
      recommended: 'recommended' in recipe && isStringArray(recipe.recommended) ? recipe.recommended : undefined,
      backend: 'backend' in recipe && typeof recipe.backend === 'string' ? recipe.backend : undefined,
    };
  throw new Error('invalid recipe format');
}

export function isLocalModelInfo(obj: unknown): obj is LocalModelInfo {
  return (
    isNonNullObject(obj) &&
    'file' in obj &&
    typeof obj.file === 'string' &&
    'path' in obj &&
    typeof obj.path === 'string'
  );
}

export function sanitizeModel(model: unknown): ModelInfo {
  if (
    isNonNullObject(model) &&
    'id' in model &&
    typeof model.id === 'string' &&
    'name' in model &&
    typeof model.name === 'string' &&
    'description' in model &&
    typeof model.description === 'string'
  )
    return {
      // mandatory fields
      id: model.id,
      name: model.name,
      description: model.description,
      // optional fields
      registry: 'registry' in model && typeof model.registry === 'string' ? model.registry : undefined,
      license: 'license' in model && typeof model.license === 'string' ? model.license : undefined,
      url: 'url' in model && typeof model.url === 'string' ? model.url : undefined,
      memory: 'memory' in model && typeof model.memory === 'number' ? model.memory : undefined,
      properties: 'properties' in model && isStringRecord(model.properties) ? model.properties : undefined,
      sha256: 'sha256' in model && typeof model.sha256 === 'string' ? model.sha256 : undefined,
      backend: 'backend' in model && typeof model.backend === 'string' ? model.backend : undefined,
      file:
        'file' in model && isLocalModelInfo(model.file)
          ? {
              ...model.file,
              creation: new Date(model.file.creation ?? 0),
            }
          : undefined,
    };
  throw new Error('invalid model format');
}

export function sanitizeCategory(category: unknown): Category {
  if (
    isNonNullObject(category) &&
    'id' in category &&
    typeof category.id === 'string' &&
    'name' in category &&
    typeof category.name === 'string' &&
    'description' in category &&
    typeof category.description === 'string'
  )
    return {
      // mandatory fields
      id: category.id,
      name: category.name,
      description: category.description,
    };
  throw new Error('invalid category format');
}
