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

import { Uri, type WebviewOptions, type WebviewPanel, window } from '@podman-desktop/api';
import { promises } from 'node:fs';

function getWebviewOptions(extensionUri: Uri): WebviewOptions {
  return {
    // Enable javascript in the webview
    // enableScripts: true,

    // And restrict the webview to only loading content from our extension's `media` directory.
    localResourceRoots: [Uri.joinPath(extensionUri, 'media')],
  };
}

export async function initWebview(extensionUri: Uri): Promise<WebviewPanel> {
  // register webview
  const panel = window.createWebviewPanel('studio', 'AI Lab', getWebviewOptions(extensionUri));

  // update html
  const indexHtmlUri = Uri.joinPath(extensionUri, 'media', 'index.html');
  const indexHtmlPath = indexHtmlUri.fsPath;

  let indexHtml = await promises.readFile(indexHtmlPath, 'utf8');

  // replace links with webView Uri links
  // in the content <script type="module" crossorigin src="./index-RKnfBG18.js"></script> replace src with webview.asWebviewUri
  const scriptLink = indexHtml.match(/<script.*?src="(.*?)".*?>/g);
  if (scriptLink) {
    scriptLink.forEach(link => {
      const src = link.match(/src="(.*?)"/);
      if (src) {
        const webviewSrc = panel.webview.asWebviewUri(Uri.joinPath(extensionUri, 'media', src[1]));
        if (!webviewSrc) throw new Error('undefined webviewSrc');
        indexHtml = indexHtml.replace(src[1], webviewSrc.toString());
      }
    });
  }

  // and now replace for css file as well
  const cssLink = indexHtml.match(/<link.*?href="(.*?)".*?>/g);
  if (cssLink) {
    cssLink.forEach(link => {
      const href = link.match(/href="(.*?)"/);
      if (href) {
        const webviewHref = panel.webview.asWebviewUri(Uri.joinPath(extensionUri, 'media', href[1]));
        if (!webviewHref)
          throw new Error('Something went wrong while replacing links with webView Uri links: undefined webviewHref');
        indexHtml = indexHtml.replace(href[1], webviewHref.toString());
      }
    });
  }

  panel.webview.html = indexHtml;

  return panel;
}
