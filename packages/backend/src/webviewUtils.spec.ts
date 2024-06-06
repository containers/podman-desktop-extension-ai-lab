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
import { initWebview } from './webviewUtils';
import type { Uri } from '@podman-desktop/api';
import { promises } from 'node:fs';

vi.mock('@podman-desktop/api', async () => {
  return {
    Uri: class {
      static joinPath = () => ({ fsPath: '.' });
    },
    window: {
      createWebviewPanel: () => ({
        webview: {
          html: '',
          onDidReceiveMessage: vi.fn(),
          postMessage: vi.fn(),
          asWebviewUri: () => 'dummy-src',
        },
        onDidChangeViewState: vi.fn(),
      }),
    },
  };
});

vi.mock('node:fs', () => ({
  promises: {
    readFile: vi.fn(),
  },
}));

beforeEach(() => {
  vi.resetAllMocks();
});

test('panel should have file content as html', async () => {
  vi.mocked(promises.readFile).mockImplementation(() => {
    return Promise.resolve('<html></html>');
  });

  const panel = await initWebview({} as unknown as Uri);
  expect(panel.webview.html).toBe('<html></html>');
});

test('script src should be replaced with asWebviewUri result', async () => {
  vi.mocked(promises.readFile).mockImplementation(() => {
    return Promise.resolve('<script type="module" crossorigin src="./index-RKnfBG18.js"></script>');
  });

  const panel = await initWebview({} as unknown as Uri);
  expect(panel.webview.html).toBe('<script type="module" crossorigin src="dummy-src"></script>');
});

test('links src should be replaced with asWebviewUri result', async () => {
  vi.mocked(promises.readFile).mockImplementation(() => {
    return Promise.resolve('<link rel="stylesheet" href="./styles.css">');
  });

  const panel = await initWebview({} as unknown as Uri);
  expect(panel.webview.html).toBe('<link rel="stylesheet" href="dummy-src">');
});
