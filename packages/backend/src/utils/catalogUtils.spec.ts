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
import {
  CatalogFormat,
  hasCatalogWrongFormat,
  isNonNullObject,
  merge,
  sanitize,
  sanitizeCategory,
  sanitizeModel,
  sanitizeRecipe,
} from './catalogUtils';

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

describe('sanitize', () => {
  test('should adapt object not having any version to CURRENT format', () => {
    const raw = {
      recipes: [
        {
          id: 'chatbot',
          description: 'This is a Streamlit chat demo application.',
          name: 'ChatBot',
          repository: 'https://github.com/containers/ai-lab-recipes',
          ref: 'v1.1.3',
          icon: 'natural-language-processing',
          categories: ['natural-language-processing'],
          basedir: 'recipes/natural_language_processing/chatbot',
          readme: '',
          models: ['hf.instructlab.granite-7b-lab-GGUF', 'hf.instructlab.merlinite-7b-lab-GGUF'],
        },
      ],
      models: [
        {
          id: 'Mistral-7B-Instruct-v0.3-Q4_K_M.gguf',
          name: 'Mistral-7B-Instruct-v0.3-Q4_K_M',
          description: 'Model imported from path\\Mistral-7B-Instruct-v0.3-Q4_K_M.gguf',
          hw: 'CPU',
          file: {
            path: 'path',
            file: 'Mistral-7B-Instruct-v0.3-Q4_K_M.gguf',
            size: 4372812000,
            creation: '2024-06-19T12:14:12.489Z',
          },
          memory: 4372812000,
        },
      ],
    };
    expect(hasCatalogWrongFormat(raw)).toBeTruthy();
    const catalog = sanitize(raw);
    expect(catalog.version).equals(CatalogFormat.CURRENT);
    expect(catalog.models[0].backend).equals('llama-cpp');
    expect(catalog.models[0].name).equals('Mistral-7B-Instruct-v0.3-Q4_K_M');
  });

  test('should throw if version is different from CURRENT', () => {
    const raw = {
      version: '0.5',
      recipes: [
        {
          id: 'chatbot',
          description: 'This is a Streamlit chat demo application.',
          name: 'ChatBot',
          repository: 'https://github.com/containers/ai-lab-recipes',
          ref: 'v1.1.3',
          icon: 'natural-language-processing',
          categories: ['natural-language-processing'],
          basedir: 'recipes/natural_language_processing/chatbot',
          readme: '',
          recommended: ['hf.instructlab.granite-7b-lab-GGUF', 'hf.instructlab.merlinite-7b-lab-GGUF'],
          backend: 'llama-cpp',
        },
      ],
      models: [
        {
          id: 'Mistral-7B-Instruct-v0.3-Q4_K_M.gguf',
          name: 'Mistral-7B-Instruct-v0.3-Q4_K_M',
          description: 'Model imported from path\\Mistral-7B-Instruct-v0.3-Q4_K_M.gguf',
          hw: 'CPU',
          file: {
            path: 'path',
            file: 'Mistral-7B-Instruct-v0.3-Q4_K_M.gguf',
            size: 4372812000,
            creation: '2024-06-19T12:14:12.489Z',
          },
          memory: 4372812000,
        },
      ],
    };

    expect(hasCatalogWrongFormat(raw)).toBeFalsy();
    expect(() => sanitize(raw)).toThrowError('the catalog is using an invalid version');
  });

  test('should return sanitized ApplicationCatalog with valid raw object', () => {
    const raw = {
      version: '1.0',
      recipes: [
        {
          id: 'chatbot',
          description: 'This is a Streamlit chat demo application.',
          name: 'ChatBot',
          repository: 'https://github.com/containers/ai-lab-recipes',
          ref: 'v1.1.3',
          icon: 'natural-language-processing',
          categories: ['natural-language-processing'],
          basedir: 'recipes/natural_language_processing/chatbot',
          readme: '',
          recommended: ['hf.instructlab.granite-7b-lab-GGUF', 'hf.instructlab.merlinite-7b-lab-GGUF'],
          backend: 'llama-cpp',
          language: 'lang1',
          frameworks: ['fw1'],
        },
      ],
      models: [
        {
          id: 'Mistral-7B-Instruct-v0.3-Q4_K_M.gguf',
          name: 'Mistral-7B-Instruct-v0.3-Q4_K_M',
          description: 'Model imported from path\\Mistral-7B-Instruct-v0.3-Q4_K_M.gguf',
          hw: 'CPU',
          file: {
            path: 'path',
            file: 'Mistral-7B-Instruct-v0.3-Q4_K_M.gguf',
            size: 4372812000,
            creation: '2024-06-19T12:14:12.489Z',
          },
          memory: 4372812000,
        },
      ],
    };
    expect(hasCatalogWrongFormat(raw)).toBeFalsy();
    const catalog = sanitize(raw);
    expect(catalog.version).equals(CatalogFormat.CURRENT);
    expect(catalog.models[0].backend).toBeUndefined();
    expect(catalog.models[0].name).equals('Mistral-7B-Instruct-v0.3-Q4_K_M');
    expect(catalog.recipes[0].language).equals('lang1');
    expect(catalog.recipes[0].frameworks).toStrictEqual(['fw1']);
  });
});

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
