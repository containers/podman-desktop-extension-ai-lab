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

import type { LocalModelInfo } from '@shared/src/models/ILocalModelInfo';
import fs from 'fs';
import * as path from 'node:path';
import { type Webview, fs as apiFs } from '@podman-desktop/api';
import { MSG_NEW_MODELS_STATE } from '@shared/Messages';
import type { CatalogManager } from './catalogManager';
import type { ModelInfo } from '@shared/src/models/IModelInfo';
import * as podmanDesktopApi from '@podman-desktop/api';
import { Downloader, type DownloadEvent, isCompletionEvent, isProgressEvent } from '../utils/downloader';
import type { TaskRegistry } from '../registries/TaskRegistry';
import type { Task } from '@shared/src/models/ITask';

export type DownloadModelResult = DownloadModelSuccessfulResult | DownloadModelFailureResult;

interface DownloadModelSuccessfulResult {
  successful: true;
  path: string;
}

interface DownloadModelFailureResult {
  successful: false;
  error: string;
}

export class ModelsManager {
  #modelsDir: string;
  #models: Map<string, ModelInfo>;
  #watcher?: podmanDesktopApi.FileSystemWatcher;

  constructor(
    private appUserDirectory: string,
    private webview: Webview,
    private catalogManager: CatalogManager,
    private telemetry: podmanDesktopApi.TelemetryLogger,
    private taskRegistry: TaskRegistry,
  ) {
    this.#modelsDir = path.join(this.appUserDirectory, 'models');
    this.#models = new Map();
  }

  async loadLocalModels() {
    this.catalogManager.getModels().forEach(m => this.#models.set(m.id, m));
    const reloadLocalModels = async () => {
      this.getLocalModelsFromDisk();
      await this.sendModelsInfo();
    };
    if (this.#watcher === undefined) {
      this.#watcher = apiFs.createFileSystemWatcher(this.#modelsDir);
      this.#watcher.onDidCreate(reloadLocalModels);
      this.#watcher.onDidDelete(reloadLocalModels);
      this.#watcher.onDidChange(reloadLocalModels);
    }

    // Initialize the local models manually
    await reloadLocalModels();
  }

  getModelsInfo() {
    return [...this.#models.values()];
  }

  async sendModelsInfo() {
    const models = this.getModelsInfo();
    await this.webview.postMessage({
      id: MSG_NEW_MODELS_STATE,
      body: models,
    });
  }

  getModelsDirectory(): string {
    return this.#modelsDir;
  }

  getLocalModelsFromDisk(): void {
    if (!fs.existsSync(this.#modelsDir)) {
      return;
    }
    const entries = fs.readdirSync(this.#modelsDir, { withFileTypes: true });
    const dirs = entries.filter(dir => dir.isDirectory());
    for (const d of dirs) {
      const modelEntries = fs.readdirSync(path.resolve(d.path, d.name));
      if (modelEntries.length !== 1) {
        // we support models with one file only for now
        continue;
      }
      const modelFile = modelEntries[0];
      const fullPath = path.resolve(d.path, d.name, modelFile);

      let info: { size?: number; mtime?: Date } = { size: undefined, mtime: undefined };
      try {
        info = fs.statSync(fullPath);
      } catch (err: unknown) {
        console.error('Something went wrong while getting file stats (probably in use).', err);
      }

      const model = this.#models.get(d.name);
      if (model) {
        model.file = {
          file: modelFile,
          path: path.resolve(d.path, d.name),
          size: info.size,
          creation: info.mtime,
        };
      }
    }
  }

  isModelOnDisk(modelId: string) {
    return this.#models.get(modelId)?.file !== undefined;
  }

  getLocalModelInfo(modelId: string): LocalModelInfo {
    if (!this.isModelOnDisk(modelId)) {
      throw new Error('model is not on disk');
    }
    return this.#models.get(modelId).file;
  }

  getModelInfo(modelId: string): ModelInfo {
    const model = this.#models.get(modelId);
    if (!model) {
      throw new Error('model is not loaded');
    }
    return model;
  }

  getLocalModelPath(modelId: string): string {
    const info = this.getLocalModelInfo(modelId);
    return path.resolve(this.#modelsDir, modelId, info.file);
  }

  getLocalModelFolder(modelId: string): string {
    return path.resolve(this.#modelsDir, modelId);
  }

  async deleteLocalModel(modelId: string): Promise<void> {
    const model = this.#models.get(modelId);
    if (model) {
      const modelDir = this.getLocalModelFolder(modelId);
      model.state = 'deleting';
      await this.sendModelsInfo();
      try {
        await fs.promises.rm(modelDir, { recursive: true });
        this.telemetry.logUsage('model.delete', { 'model.id': modelId });
        model.file = model.state = undefined;
      } catch (err: unknown) {
        this.telemetry.logError('model.delete', {
          'model.id': modelId,
          message: 'error deleting model from disk',
          error: err,
        });
        await podmanDesktopApi.window.showErrorMessage(`Error deleting model ${modelId}. ${String(err)}`);

        // Let's reload the models manually to avoid any issue
        model.state = undefined;
        this.getLocalModelsFromDisk();
      } finally {
        await this.sendModelsInfo();
      }
    }
  }

  async downloadModel(model: ModelInfo): Promise<string> {
    const task: Task = this.taskRegistry.get(model.id) || {
      id: model.id,
      state: 'loading',
      name: `Downloading model ${model.name}`,
      labels: {
        'model-pulling': model.id,
      },
    };

    // Check if the model is already on disk.
    if (this.isModelOnDisk(model.id)) {
      task.state = 'success';
      task.name = `Model ${model.name} already present on disk`;
      this.taskRegistry.set(task); // update task

      // return model path
      return this.getLocalModelPath(model.id);
    }

    // update task to loading state
    this.taskRegistry.set(task);

    // Ensure path to model directory exist
    const destDir = path.join(this.appUserDirectory, 'models', model.id);
    if (!fs.existsSync(destDir)) {
      fs.mkdirSync(destDir, { recursive: true });
    }

    const target = path.resolve(destDir, path.basename(model.url));
    // Create a downloader
    const downloader = new Downloader(model.url, target);

    // Capture downloader events
    downloader.onEvent((event: DownloadEvent) => {
      if (isProgressEvent(event)) {
        task.state = 'loading';
        task.progress = event.value;
      } else if (isCompletionEvent(event)) {
        // status error or canceled
        if (event.status === 'error' || event.status === 'canceled') {
          task.state = 'error';
          task.progress = undefined;
          task.error = event.message;

          // telemetry usage
          this.telemetry.logError('model.download', {
            'model.id': model.id,
            message: 'error downloading model',
            error: event.message,
            durationSeconds: event.duration,
          });
        } else {
          task.state = 'success';
          task.progress = 100;

          // telemetry usage
          this.telemetry.logUsage('model.download', { 'model.id': model.id, durationSeconds: event.duration });
        }
      }

      this.taskRegistry.set(task); // update task
    });

    // perform download
    await downloader.perform();
    return target;
  }
}
