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

import type { ExtensionContext, WebviewOptions , WebviewPanel} from '@podman-desktop/api';
import { Uri , window } from '@podman-desktop/api';
import { promises } from 'node:fs';

export class Studio {
  readonly #extensionContext: ExtensionContext;

  #panel: WebviewPanel | undefined;

  constructor(readonly extensionContext: ExtensionContext) {
    this.#extensionContext = extensionContext;
  }

  public async activate(): Promise<void> {
    console.log('starting studio extension');

    const extensionUri = this.#extensionContext.extensionUri;

    // register webview
    this.#panel = window.createWebviewPanel('studio', 'Studio extension', this.getWebviewOptions(extensionUri));

    // update html

    const indexHtmlUri = Uri.joinPath(extensionUri, 'media', 'index.html');
    const indexHtmlPath = indexHtmlUri.fsPath;
    const indexHtml = await promises.readFile(indexHtmlPath, 'utf8');

    this.#panel.webview.html = indexHtml;
  }

  public async deactivate(): Promise<void> {
    console.log('stopping studio extension');
  }

  getWebviewOptions(extensionUri: Uri): WebviewOptions {
    return {
      // Enable javascript in the webview
      // enableScripts: true,

      // And restrict the webview to only loading content from our extension's `media` directory.
      localResourceRoots: [Uri.joinPath(extensionUri, 'media')],
    };
  }
}
