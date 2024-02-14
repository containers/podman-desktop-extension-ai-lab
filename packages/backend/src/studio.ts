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

import type {
  ExtensionContext,
  TelemetryLogger,
  WebviewOptions,
  WebviewPanel,
  WebviewPanelOnDidChangeViewStateEvent,
} from '@podman-desktop/api';
import { Uri, window, env } from '@podman-desktop/api';
import { RpcExtension } from '@shared/src/messages/MessageProxy';
import { StudioApiImpl } from './studio-api-impl';
import { ApplicationManager } from './managers/applicationManager';
import { GitManager } from './managers/gitManager';
import { RecipeStatusRegistry } from './registries/RecipeStatusRegistry';
import { TaskRegistry } from './registries/TaskRegistry';
import { PlayGroundManager } from './managers/playground';
import { CatalogManager } from './managers/catalogManager';
import { ModelsManager } from './managers/modelsManager';
import path from 'node:path';
import os from 'os';
import fs from 'node:fs';
import { ContainerRegistry } from './registries/ContainerRegistry';
import { PodmanConnection } from './managers/podmanConnection';
import { LocalRepositoryRegistry } from './registries/LocalRepositoryRegistry';

// TODO: Need to be configured
export const AI_STUDIO_FOLDER = path.join('podman-desktop', 'ai-studio');

export class Studio {
  readonly #extensionContext: ExtensionContext;

  #panel: WebviewPanel | undefined;

  rpcExtension: RpcExtension;
  studioApi: StudioApiImpl;
  playgroundManager: PlayGroundManager;
  catalogManager: CatalogManager;
  modelsManager: ModelsManager;
  telemetry: TelemetryLogger;

  constructor(readonly extensionContext: ExtensionContext) {
    this.#extensionContext = extensionContext;
  }

  public async activate(): Promise<void> {
    console.log('starting studio extension');

    this.telemetry = env.createTelemetryLogger();
    this.telemetry.logUsage('start');

    const extensionUri = this.#extensionContext.extensionUri;

    // register webview
    this.#panel = window.createWebviewPanel('studio', 'AI Studio', this.getWebviewOptions(extensionUri));
    this.#extensionContext.subscriptions.push(this.#panel);

    // update html

    const indexHtmlUri = Uri.joinPath(extensionUri, 'media', 'index.html');
    const indexHtmlPath = indexHtmlUri.fsPath;

    let indexHtml = await fs.promises.readFile(indexHtmlPath, 'utf8');

    // replace links with webView Uri links
    // in the content <script type="module" crossorigin src="./index-RKnfBG18.js"></script> replace src with webview.asWebviewUri
    const scriptLink = indexHtml.match(/<script.*?src="(.*?)".*?>/g);
    if (scriptLink) {
      scriptLink.forEach(link => {
        const src = link.match(/src="(.*?)"/);
        if (src) {
          const webviewSrc = this.#panel?.webview.asWebviewUri(Uri.joinPath(extensionUri, 'media', src[1]));
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
          const webviewHref = this.#panel?.webview.asWebviewUri(Uri.joinPath(extensionUri, 'media', href[1]));
          indexHtml = indexHtml.replace(href[1], webviewHref.toString());
        }
      });
    }

    console.log('updated indexHtml to', indexHtml);

    this.#panel.webview.html = indexHtml;

    // Creating container registry
    const containerRegistry = new ContainerRegistry();
    this.#extensionContext.subscriptions.push(containerRegistry.init());

    // Let's create the api that the front will be able to call
    const appUserDirectory = path.join(os.homedir(), AI_STUDIO_FOLDER);

    this.rpcExtension = new RpcExtension(this.#panel.webview);
    const gitManager = new GitManager();

    const podmanConnection = new PodmanConnection();
    const taskRegistry = new TaskRegistry(this.#panel.webview);
    const recipeStatusRegistry = new RecipeStatusRegistry(taskRegistry, this.#panel.webview);
    this.playgroundManager = new PlayGroundManager(
      this.#panel.webview,
      containerRegistry,
      podmanConnection,
      this.telemetry,
    );
    // Create catalog manager, responsible for loading the catalog files and watching for changes
    this.catalogManager = new CatalogManager(appUserDirectory, this.#panel.webview);
    this.modelsManager = new ModelsManager(
      appUserDirectory,
      this.#panel.webview,
      this.catalogManager,
      this.telemetry,
      taskRegistry,
    );
    const localRepositoryRegistry = new LocalRepositoryRegistry(this.#panel.webview);
    const applicationManager = new ApplicationManager(
      appUserDirectory,
      gitManager,
      recipeStatusRegistry,
      this.#panel.webview,
      podmanConnection,
      this.catalogManager,
      this.modelsManager,
      this.telemetry,
      localRepositoryRegistry,
    );

    this.#panel.onDidChangeViewState((e: WebviewPanelOnDidChangeViewStateEvent) => {
      this.telemetry.logUsage(e.webviewPanel.visible ? 'opened' : 'closed');
    });

    // Creating StudioApiImpl
    this.studioApi = new StudioApiImpl(
      applicationManager,
      recipeStatusRegistry,
      this.playgroundManager,
      this.catalogManager,
      this.modelsManager,
      this.telemetry,
      localRepositoryRegistry,
    );

    await this.catalogManager.loadCatalog();
    await this.modelsManager.loadLocalModels();
    podmanConnection.init();
    this.playgroundManager.adoptRunningPlaygrounds();
    applicationManager.adoptRunningEnvironments();

    // Register the instance
    this.rpcExtension.registerInstance<StudioApiImpl>(StudioApiImpl, this.studioApi);
  }

  public async deactivate(): Promise<void> {
    console.log('stopping studio extension');
    this.telemetry.logUsage('stop');
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
