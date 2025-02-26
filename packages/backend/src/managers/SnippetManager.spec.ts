/**********************************************************************
 * Copyright (C) 2024-2025 Red Hat, Inc.
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
import type { TelemetryLogger } from '@podman-desktop/api';
import type { RpcExtension } from '@shared/src/messages/MessageProxy';
import { MSG_SUPPORTED_LANGUAGES_UPDATE } from '@shared/Messages';

const rpcExtensionMock = {
  fire: vi.fn(),
} as unknown as RpcExtension;

const telemetryMock = {
  logUsage: vi.fn(),
  logError: vi.fn(),
} as unknown as TelemetryLogger;

beforeEach(() => {
  vi.resetAllMocks();
  vi.mocked(rpcExtensionMock.fire).mockResolvedValue(true);
});

test('expect init to notify webview', () => {
  const manager = new SnippetManager(rpcExtensionMock, telemetryMock);
  manager.init();

  expect(rpcExtensionMock.fire).toHaveBeenCalledWith(MSG_SUPPORTED_LANGUAGES_UPDATE, manager.getLanguageList());
});

test('expect postman-code-generators to have many languages available.', () => {
  const manager = new SnippetManager(rpcExtensionMock, telemetryMock);
  manager.init();

  expect(manager.getLanguageList().length).toBeGreaterThan(0);
});

test('expect postman-code-generators to have nodejs supported.', () => {
  const manager = new SnippetManager(rpcExtensionMock, telemetryMock);
  manager.init();

  const languages = manager.getLanguageList();
  const nodejs = languages.find(language => language.key === 'nodejs');
  expect(nodejs).toBeDefined();
  expect(nodejs?.variants.length).toBeGreaterThan(0);

  const native = nodejs?.variants.find(variant => variant.key === 'Request');
  expect(native).toBeDefined();
});

test('expect postman-code-generators to generate proper nodejs native code', async () => {
  const manager = new SnippetManager(rpcExtensionMock, telemetryMock);
  manager.init();

  const snippet = await manager.generate(
    {
      url: 'http://localhost:8080',
    },
    'nodejs',
    'Request',
  );
  expect(snippet).toBe(`var request = require('request');
var options = {
  'method': 'GET',
  'url': 'http://localhost:8080',
  'headers': {
  }
};
request(options, function (error, response) {
  if (error) throw new Error(error);
  console.log(response.body);
});
`);
});

test('expect snippet manager to have Quarkus Langchain4J supported.', () => {
  const manager = new SnippetManager(rpcExtensionMock, telemetryMock);
  manager.init();

  const languages = manager.getLanguageList();
  const java = languages.find(language => language.key === 'java');
  expect(java).toBeDefined();
  expect(java?.variants.length).toBeGreaterThan(0);

  const quarkus_langchain4j = java?.variants.find(variant => variant.key === 'Quarkus Langchain4J');
  expect(quarkus_langchain4j).toBeDefined();
});

test('expect new variant to replace existing one if same name', () => {
  const manager = new SnippetManager(rpcExtensionMock, telemetryMock);
  manager.init();

  const languages = manager.getLanguageList();
  const java = languages.find(language => language.key === 'java');
  expect(java).toBeDefined();
  expect(java?.variants.length).toBeGreaterThan(0);

  if (!java) throw new Error('undefined java');

  const oldVariantsNumber = java.variants.length;
  manager.addVariant('java', java.variants[0].key, vi.fn());
  const languages_updated = manager.getLanguageList();
  const java_updated = languages_updated.find(language => language.key === 'java');
  expect(java_updated).toBeDefined();
  expect(java_updated?.variants.length).equals(oldVariantsNumber);
});
