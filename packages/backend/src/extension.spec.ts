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
import type { ExtensionContext } from '@podman-desktop/api';
import { activate, deactivate } from './extension';
import { Studio } from './studio';

vi.mock('./studio');

beforeEach(() => {
  vi.clearAllMocks();
});

test('check we call activate method on studio instance', async () => {
  const fakeContext = {} as unknown as ExtensionContext;

  await activate(fakeContext);

  // expect the activate method to be called on the studio mock
  expect(Studio.prototype.activate).toBeCalledTimes(1);

  // no call on deactivate
  expect(Studio.prototype.deactivate).not.toBeCalled();
});

test('check we call deactivate method on studio instance ', async () => {
  await deactivate();

  // expect the activate method to be called on the studio mock
  expect(Studio.prototype.deactivate).toBeCalledTimes(1);

  // no call on activate
  expect(Studio.prototype.activate).not.toBeCalled();
});
