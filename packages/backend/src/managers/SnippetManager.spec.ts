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
import { SnippetManager } from './SnippetManager';
import { getLanguageList, convert } from 'postman-code-generators';
import type { Webview } from '@podman-desktop/api';
import { Request } from 'postman-collection';
import { MSG_SUPPORTED_LANGUAGES_UPDATE } from '@shared/Messages';
vi.mock('postman-code-generators', () => {
  return {
    getLanguageList: vi.fn(),
    convert: vi.fn(),
  };
});

const webviewMock = {
  postMessage: vi.fn(),
} as unknown as Webview;

beforeEach(() => {
  vi.resetAllMocks();

  vi.mocked(webviewMock.postMessage).mockResolvedValue(undefined);
  vi.mocked(getLanguageList).mockReturnValue([]);
});

test('expect init to notify webview', () => {
  const manager = new SnippetManager(webviewMock);
  manager.init();

  expect(webviewMock.postMessage).toHaveBeenCalledWith({
    id: MSG_SUPPORTED_LANGUAGES_UPDATE,
    body: [],
  });
});

test('expect getLanguageList to call postman code generator getLanguageList', () => {
  const manager = new SnippetManager(webviewMock);
  manager.getLanguageList();

  expect(getLanguageList).toHaveBeenCalledOnce();
});

test('expect generate to call postman code generator convert', async () => {
  vi.mocked(convert).mockImplementation((language, variant, request, options, callback) => {
    expect(language).toBe('nodejs');
    expect(variant).toBe('request');
    expect(request).toStrictEqual(new Request('http://localhost:8888'));
    expect(options).toStrictEqual({});
    callback(undefined, 'valid-snippet');
  });

  const manager = new SnippetManager(webviewMock);
  const snippet = await manager.generate('http://localhost:8888', 'nodejs', 'request');

  expect(snippet).toBe('valid-snippet');
  expect(convert).toHaveBeenCalled();
});

test('expect generate reject if callback provide an error', async () => {
  vi.mocked(convert).mockImplementation((_language, _variant, _request, _options, callback) => {
    callback(new Error('random'), undefined);
  });

  const manager = new SnippetManager(webviewMock);
  await expect(manager.generate('http://localhost:8888', 'nodejs', 'request')).rejects.toThrowError('random');
  expect(convert).toHaveBeenCalled();
});
