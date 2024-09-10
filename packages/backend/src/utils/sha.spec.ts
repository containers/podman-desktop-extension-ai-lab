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
import { beforeEach, expect, test, vi, describe } from 'vitest';
import * as fs from 'node:fs';
import { getHash, hasValidSha } from './sha';
import { Readable } from 'node:stream';

beforeEach(() => {
  vi.resetAllMocks();
});

test('return true if file has same hash of the expected one', () => {
  vi.mock('node:fs');

  const readable = Readable.from('test');

  vi.spyOn(fs, 'createReadStream').mockImplementation(() => {
    return readable as fs.ReadStream;
  });

  // sha of test => 9f86d081884c7d659a2feaa0c55ad015a3bf4f1b2b0b822cd15d6c15b0f00a08
  const isValid = hasValidSha('file', '9f86d081884c7d659a2feaa0c55ad015a3bf4f1b2b0b822cd15d6c15b0f00a08');
  expect(isValid).toBeTruthy();
});

test('return false if file has different hash of the expected one', () => {
  vi.mock('node:fs');
  const readable = Readable.from('test');

  vi.spyOn(fs, 'createReadStream').mockImplementation(() => {
    return readable as fs.ReadStream;
  });

  // sha of test => 9f86d081884c7d659a2feaa0c55ad015a3bf4f1b2b0b822cd15d6c15b0f00a08
  const isValid = hasValidSha('file', 'fakeSha');
  expect(isValid).toBeTruthy();
});

describe('sha512', () => {
  test('basic string', () => {
    const result = getHash('hello-world');
    expect(result).toBe(
      '6aeefc29122a3962c90ef834f6caad0033bffcd62941b7a6205a695cc39e2767db7778a7ad76d173a083b9e14b210dc0212923f481b285c784ab1fe340d7ff4d',
    );
  });

  test('very long string', () => {
    const result = getHash('x'.repeat(1024));
    expect(result).toBe(
      'fa41ec783342d4c23e7b6550f1e96e32a16269e390449e5fdda60f05611ecb08dd56a5b8cde90024b7da934cdb9a9cc8c8a310eb20e25227699bbf6518e23360',
    );
  });
});
