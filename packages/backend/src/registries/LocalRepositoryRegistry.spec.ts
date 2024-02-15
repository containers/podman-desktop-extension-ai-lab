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
import { LocalRepositoryRegistry } from './LocalRepositoryRegistry';
import { MSG_LOCAL_REPOSITORY_UPDATE } from '@shared/Messages';
import type { Webview } from '@podman-desktop/api';

const mocks = vi.hoisted(() => ({
  DisposableCreateMock: vi.fn(),
  postMessageMock: vi.fn(),
}));

vi.mock('@podman-desktop/api', async () => {
  return {
    Disposable: {
      create: mocks.DisposableCreateMock,
    },
  };
});

beforeEach(() => {
  vi.resetAllMocks();
  mocks.postMessageMock.mockResolvedValue(undefined);
});

test('should not have any repositories by default', () => {
  const localRepositories = new LocalRepositoryRegistry({
    postMessage: mocks.postMessageMock,
  } as unknown as Webview);
  expect(localRepositories.getLocalRepositories().length).toBe(0);
});

test('should notify webview when register', () => {
  const localRepositories = new LocalRepositoryRegistry({
    postMessage: mocks.postMessageMock,
  } as unknown as Webview);
  localRepositories.register({ path: 'random', recipeId: 'random' });
  expect(mocks.postMessageMock).toHaveBeenNthCalledWith(1, {
    id: MSG_LOCAL_REPOSITORY_UPDATE,
    body: [{ path: 'random', recipeId: 'random' }],
  });
});

test('should notify webview when unregister', () => {
  const localRepositories = new LocalRepositoryRegistry({
    postMessage: mocks.postMessageMock,
  } as unknown as Webview);
  localRepositories.register({ path: 'random', recipeId: 'random' });
  localRepositories.unregister('random');

  expect(mocks.postMessageMock).toHaveBeenLastCalledWith({
    id: MSG_LOCAL_REPOSITORY_UPDATE,
    body: [],
  });
});
