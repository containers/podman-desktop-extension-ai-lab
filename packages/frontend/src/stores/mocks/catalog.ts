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

/**
  To use this mock from a test:
  
  ```
  const { mockCatalogStore } = await vi.hoisted(() => import('/@/stores/mocks/catalog'));
  
  vi.mock('/@/stores/catalog', async () => {
    return {
      catalog: mockCatalogStore,
    };
  });

  test('should ...', async () => {
    mockCatalogStore.mockSetSubscribeValue(initialCatalog);
    ...
  }
*/
import type { Catalog } from '@shared/src/models/ICatalog';
import { writable } from 'svelte/store';

const mockCatalogWritable = writable<Catalog>();

export const mockCatalogStore = {
  subscribe: mockCatalogWritable.subscribe,
  mockSetSubscribeValue: (value: Catalog): void => mockCatalogWritable.set(value),
};
