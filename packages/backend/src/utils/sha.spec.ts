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
import { promises } from 'node:fs';
import { hasValidSha } from './sha';

beforeEach(() => {
  vi.resetAllMocks();
});

test('return true if file has same hash of the expected one', () => {
  vi.mock('node:fs');
  vi.spyOn(promises, 'readFile').mockImplementation(() => Promise.resolve(Buffer.from('test')));

  // sha of test => 9f86d081884c7d659a2feaa0c55ad015a3bf4f1b2b0b822cd15d6c15b0f00a08
  const isValid = hasValidSha('file', '9f86d081884c7d659a2feaa0c55ad015a3bf4f1b2b0b822cd15d6c15b0f00a08');
  expect(isValid).toBeTruthy();
});

test('return false if file has different hash of the expected one', () => {
  vi.mock('node:fs');
  vi.spyOn(promises, 'readFile').mockImplementation(() => Promise.resolve(Buffer.from('test')));

  // sha of test => 9f86d081884c7d659a2feaa0c55ad015a3bf4f1b2b0b822cd15d6c15b0f00a08
  const isValid = hasValidSha('file', 'fakeSha');
  expect(isValid).toBeTruthy();
});
