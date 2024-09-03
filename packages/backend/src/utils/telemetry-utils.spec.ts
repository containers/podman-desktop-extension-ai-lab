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

import { beforeEach, expect, test, vi } from 'vitest';
import { anonymiseModel, IMPORTED_PLACEHOLDER } from './telemetry-utils';

beforeEach(() => {
  vi.resetAllMocks();
});

test('model without url should be anonymised', () => {
  const result = anonymiseModel({
    name: '',
    url: undefined,
    id: '',
    description: '',
  });

  expect(result).toBe(IMPORTED_PLACEHOLDER);
});

test('model with absolute path in id should be anonymised', () => {
  const result = anonymiseModel({
    id: '/home/file.guff',
    url: 'https://real-website.does-not-exist',
    name: '',
    description: '',
  });

  expect(result).toBe(IMPORTED_PLACEHOLDER);
});

test('model with basic id and no url should be anonymised', () => {
  const result = anonymiseModel({
    id: 'random-file.guff',
    url: undefined,
    name: '',
    description: '',
  });

  expect(result).toBe(IMPORTED_PLACEHOLDER);
});

test('model with basic id and url should not be anonymised', () => {
  const result = anonymiseModel({
    id: 'random-file.guff',
    url: 'https://real-website.does-not-exist',
    name: '',
    description: '',
  });

  expect(result).toBe('random-file.guff');
});
