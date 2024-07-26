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

import { test, expect, describe } from 'vitest';
import { CatalogFormat, isNonNullObject, merge, sanitizeCategory, sanitizeModel, sanitizeRecipe } from './catalogUtils';

// Dummy data for testing
const validModel = {
  id: 'model-1',
  name: 'Test Model',
  description: 'A test model',
};

const validRecipe = {
  id: 'recipe-1',
  name: 'Test Recipe',
  categories: ['category-1'],
  description: 'A test recipe',
  repository: 'http://example.com',
  readme: 'Readme content',
};

const validCategory = {
  id: 'category-1',
  name: 'Test Category',
  description: 'A test category',
};

describe('merge', () => {
  test('should merge catalogs correctly', () => {
    const catalogA = {
      version: CatalogFormat.CURRENT,
      models: [{ id: 'model-1', name: 'Model A', description: 'Description A' }],
      recipes: [
        {
          id: 'recipe-1',
          name: 'Recipe A',
          categories: ['cat-1'],
          description: 'Desc A',
          repository: 'repo',
          readme: 'readme',
        },
      ],
      categories: [{ id: 'cat-1', name: 'Category A', description: 'Desc A' }],
    };

    const catalogB = {
      version: CatalogFormat.CURRENT,
      models: [{ id: 'model-2', name: 'Model B', description: 'Description B' }],
      recipes: [
        {
          id: 'recipe-2',
          name: 'Recipe B',
          categories: ['cat-2'],
          description: 'Desc B',
          repository: 'repo',
          readme: 'readme',
        },
      ],
      categories: [{ id: 'cat-2', name: 'Category B', description: 'Desc B' }],
    };

    const merged = merge(catalogA, catalogB);

    expect(merged.models).toHaveLength(2);
    expect(merged.recipes).toHaveLength(2);
    expect(merged.categories).toHaveLength(2);
  });

  test('should throw error on incompatible versions', () => {
    const catalogA = { version: CatalogFormat.CURRENT, models: [], recipes: [], categories: [] };
    const catalogB = { version: CatalogFormat.UNKNOWN, models: [], recipes: [], categories: [] };

    expect(() => merge(catalogA, catalogB)).toThrowError('cannot merge incompatible application catalog format.');
  });
});

describe('isNonNullObject', () => {
  test('should return true for non-null objects', () => {
    expect(isNonNullObject({})).toBe(true);
    expect(isNonNullObject({ key: 'value' })).toBe(true);
  });

  test('should return false for null or non-object values', () => {
    expect(isNonNullObject(undefined)).toBe(false);
    expect(isNonNullObject('string')).toBe(false);
    expect(isNonNullObject(123)).toBe(false);
  });
});

describe('sanitizeRecipe', () => {
  test('undefined object', () => {
    expect(() => sanitizeRecipe(undefined)).toThrowError('invalid recipe format');
  });

  test('valid recipe object', () => {
    expect(sanitizeRecipe(validRecipe)).toEqual(validRecipe);
  });

  test('missing mandatory fields', () => {
    const invalidRecipe = { ...validRecipe, id: undefined };
    expect(() => sanitizeRecipe(invalidRecipe)).toThrowError('invalid recipe format');
  });
});

describe('sanitizeModel', () => {
  test('undefined object', () => {
    expect(() => sanitizeModel(undefined)).toThrowError('invalid model format');
  });

  test('valid model object', () => {
    expect(sanitizeModel(validModel)).toEqual(validModel);
  });

  test('missing mandatory fields', () => {
    const invalidModel = { ...validModel, id: undefined };
    expect(() => sanitizeModel(invalidModel)).toThrowError('invalid model format');
  });
});

describe('sanitizeCategory', () => {
  test('undefined object', () => {
    expect(() => sanitizeCategory(undefined)).toThrowError('invalid category format');
  });

  test('valid category object', () => {
    expect(sanitizeCategory(validCategory)).toEqual(validCategory);
  });

  test('missing mandatory fields', () => {
    const invalidCategory = { ...validCategory, id: undefined };
    expect(() => sanitizeCategory(invalidCategory)).toThrowError('invalid category format');
  });
});
