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

import { env, version } from '@podman-desktop/api';
import { satisfies, minVersion, coerce } from 'semver';
import type {
  ExtensionContext,
  TelemetryLogger,
  WebviewPanel,
  WebviewPanelOnDidChangeViewStateEvent,
} from '@podman-desktop/api';
import { RpcExtension } from '@shared/src/messages/MessageProxy';
import { StudioApiImpl } from './studio-api-impl';
import { ApplicationManager } from './managers/applicationManager';
import { GitManager } from './managers/gitManager';
import { TaskRegistry } from './registries/TaskRegistry';
import { CatalogManager } from './managers/catalogManager';
import { ModelsManager } from './managers/modelsManager';
import { ContainerRegistry } from './registries/ContainerRegistry';
import { PodmanConnection } from './managers/podmanConnection';
import { LocalRepositoryRegistry } from './registries/LocalRepositoryRegistry';
import { InferenceManager } from './managers/inference/inferenceManager';
import { PlaygroundV2Manager } from './managers/playgroundV2Manager';
import { SnippetManager } from './managers/SnippetManager';
import { CancellationTokenRegistry } from './registries/CancellationTokenRegistry';
import { engines } from '../package.json';
import { BuilderManager } from './managers/recipes/BuilderManager';
import { PodManager } from './managers/recipes/PodManager';
import { initWebview } from './webviewUtils';

export const AI_LAB_COLLECT_GPU_COMMAND = 'ai-lab.gpu.collect';

export class Studio {
  readonly #extensionContext: ExtensionContext;

  #panel: WebviewPanel | undefined;

  rpcExtension: RpcExtension | undefined;
  studioApi: StudioApiImpl | undefined;
  catalogManager: CatalogManager | undefined;
  modelsManager: ModelsManager | undefined;
  telemetry: TelemetryLogger | undefined;

  #inferenceManager: InferenceManager | undefined;

  constructor(readonly extensionContext: ExtensionContext) {
    this.#extensionContext = extensionContext;
  }

  private checkVersion(): boolean {
    if (!version) return false;

    const current = coerce(version);
    if (!current) return false;

    if (current.major === 0 && current.minor === 0) {
      console.warn('nightlies version are not subject to version verification.');
      return true;
    }

    return satisfies(current, engines['podman-desktop']);
  }

  public async activate(): Promise<void> {
    console.log('starting AI Lab extension');
    this.telemetry = env.createTelemetryLogger();

    if (!this.checkVersion()) {
      const min = minVersion(engines['podman-desktop']) ?? { version: 'unknown' };
      const current = version ?? 'unknown';
      this.telemetry.logError('start.incompatible', {
        version: current,
        message: `error activating extension on version below ${min.version}`,
      });
      throw new Error(
        `Extension is not compatible with Podman Desktop version below ${min.version}. Current ${current}`,
      );
    }

    this.telemetry.logUsage('start');

    // init webview
    this.#panel = await initWebview(this.#extensionContext.extensionUri);
    this.#extensionContext.subscriptions.push(this.#panel);

    // Creating cancellation token registry
    const cancellationTokenRegistry = new CancellationTokenRegistry();
    this.#extensionContext.subscriptions.push(cancellationTokenRegistry);

    // Creating container registry
    const containerRegistry = new ContainerRegistry();
    this.#extensionContext.subscriptions.push(containerRegistry.init());

    const appUserDirectory = this.extensionContext.storagePath;

    this.rpcExtension = new RpcExtension(this.#panel.webview);
    const gitManager = new GitManager();

    const podmanConnection = new PodmanConnection();
    const taskRegistry = new TaskRegistry(this.#panel.webview);

    // Create catalog manager, responsible for loading the catalog files and watching for changes
    this.catalogManager = new CatalogManager(this.#panel.webview, appUserDirectory);
    this.catalogManager.init();

    const builderManager = new BuilderManager(taskRegistry);
    this.#extensionContext.subscriptions.push(builderManager);

    const podManager = new PodManager();
    podManager.init();
    this.#extensionContext.subscriptions.push(podManager);

    this.modelsManager = new ModelsManager(
      appUserDirectory,
      this.#panel.webview,
      this.catalogManager,
      this.telemetry,
      taskRegistry,
      cancellationTokenRegistry,
    );
    this.modelsManager.init();
    const localRepositoryRegistry = new LocalRepositoryRegistry(this.#panel.webview, appUserDirectory);
    localRepositoryRegistry.init(this.catalogManager.getRecipes());
    const applicationManager = new ApplicationManager(
      appUserDirectory,
      gitManager,
      taskRegistry,
      this.#panel.webview,
      podmanConnection,
      this.catalogManager,
      this.modelsManager,
      this.telemetry,
      localRepositoryRegistry,
      builderManager,
      podManager,
    );

    this.#inferenceManager = new InferenceManager(
      this.#panel.webview,
      containerRegistry,
      podmanConnection,
      this.modelsManager,
      this.telemetry,
      taskRegistry,
    );

    this.#panel.onDidChangeViewState((e: WebviewPanelOnDidChangeViewStateEvent) => {
      // Lazily init inference manager
      if (this.#inferenceManager && !this.#inferenceManager.isInitialize()) {
        this.#inferenceManager.init();
        this.#extensionContext.subscriptions.push(this.#inferenceManager);
      }

      this.telemetry?.logUsage(e.webviewPanel.visible ? 'opened' : 'closed');
    });

    const playgroundV2 = new PlaygroundV2Manager(
      this.#panel.webview,
      this.#inferenceManager,
      taskRegistry,
      this.telemetry,
    );

    const snippetManager = new SnippetManager(this.#panel.webview, this.telemetry);
    snippetManager.init();

    // Creating StudioApiImpl
    this.studioApi = new StudioApiImpl(
      applicationManager,
      this.catalogManager,
      this.modelsManager,
      this.telemetry,
      localRepositoryRegistry,
      taskRegistry,
      this.#inferenceManager,
      playgroundV2,
      snippetManager,
      cancellationTokenRegistry,
    );

    await this.modelsManager.loadLocalModels();
    podmanConnection.init();
    applicationManager.adoptRunningApplications();
    this.#extensionContext.subscriptions.push(applicationManager);

    // Register the instance
    this.rpcExtension.registerInstance<StudioApiImpl>(StudioApiImpl, this.studioApi);
    this.#extensionContext.subscriptions.push(this.catalogManager);
    this.#extensionContext.subscriptions.push(this.modelsManager);
    this.#extensionContext.subscriptions.push(podmanConnection);
  }

  public async deactivate(): Promise<void> {
    console.log('stopping AI Lab extension');
    this.telemetry?.logUsage('stop');
  }
}
