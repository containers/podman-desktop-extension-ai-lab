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
import * as https from 'node:https';
import * as path from 'node:path';
import { type Webview, fs as apiFs, Disposable } from '@podman-desktop/api';
import { MSG_NEW_MODELS_STATE } from '@shared/Messages';
import type { CatalogManager } from './catalogManager';
import type { ModelInfo } from '@shared/src/models/IModelInfo';
import * as podmanDesktopApi from '@podman-desktop/api';
import type { RecipeStatusUtils } from '../utils/recipeStatusUtils';
import { getDurationSecondsSince } from '../utils/utils';

export type DownloadModelResult = DownloadModelSuccessfulResult | DownloadModelFailureResult;

interface DownloadModelSuccessfulResult {
  successful: true;
  path: string;
}

interface DownloadModelFailureResult {
  successful: false;
  error: string;
}

export class ModelsManager implements Disposable {
  #modelsDir: string;
  #models: Map<string, ModelInfo>;
  #watcher?: podmanDesktopApi.FileSystemWatcher;

  constructor(
    private appUserDirectory: string,
    private webview: Webview,
    private catalogManager: CatalogManager,
    private telemetry: podmanDesktopApi.TelemetryLogger,
  ) {
    this.#modelsDir = path.join(this.appUserDirectory, 'models');
    this.#models = new Map();
  }

  dispose(): void {
    this.#models.clear();
    this.#watcher.dispose();
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

  async downloadModel(model: ModelInfo, taskUtil: RecipeStatusUtils) {
    if (!this.isModelOnDisk(model.id)) {
      // Download model
      taskUtil.setTask({
        id: model.id,
        state: 'loading',
        name: `Downloading model ${model.name}`,
        labels: {
          'model-pulling': model.id,
        },
      });

      const startTime = performance.now();
      try {
        const result = await this.doDownloadModelWrapper(model.id, model.url, taskUtil);
        const durationSeconds = getDurationSecondsSince(startTime);
        this.telemetry.logUsage('model.download', { 'model.id': model.id, durationSeconds });
        return result;
      } catch (e) {
        console.error(e);
        taskUtil.setTask({
          id: model.id,
          state: 'error',
          name: `Downloading model ${model.name}`,
          labels: {
            'model-pulling': model.id,
          },
        });
        const durationSeconds = getDurationSecondsSince(startTime);
        this.telemetry.logError('model.download', {
          'model.id': model.id,
          message: 'error downloading model',
          error: e,
          durationSeconds,
        });
        throw e;
      }
    } else {
      taskUtil.setTask({
        id: model.id,
        state: 'success',
        name: `Model ${model.name} already present on disk`,
        labels: {
          'model-pulling': model.id,
        },
      });
      return this.getLocalModelPath(model.id);
    }
  }

  doDownloadModelWrapper(
    modelId: string,
    url: string,
    taskUtil: RecipeStatusUtils,
    destFileName?: string,
  ): Promise<string> {
    return new Promise((resolve, reject) => {
      const downloadCallback = (result: DownloadModelResult) => {
        if (result.successful === true) {
          taskUtil.setTaskState(modelId, 'success');
          resolve(result.path);
        } else if (result.successful === false) {
          taskUtil.setTaskError(modelId, result.error);
          reject(result.error);
        }
      };

      this.doDownloadModel(modelId, url, taskUtil, downloadCallback, destFileName);
    });
  }

  doDownloadModel(
    modelId: string,
    url: string,
    taskUtil: RecipeStatusUtils,
    callback: (message: DownloadModelResult) => void,
    destFileName?: string,
  ) {
    const destDir = path.join(this.appUserDirectory, 'models', modelId);
    if (!fs.existsSync(destDir)) {
      fs.mkdirSync(destDir, { recursive: true });
    }
    if (!destFileName) {
      destFileName = path.basename(url);
    }
    const destFile = path.resolve(destDir, destFileName);
    const file = fs.createWriteStream(destFile);
    let totalFileSize = 0;
    let progress = 0;
    https.get(url, resp => {
      if (resp.headers.location) {
        this.doDownloadModel(modelId, resp.headers.location, taskUtil, callback, destFileName);
        return;
      } else {
        if (totalFileSize === 0 && resp.headers['content-length']) {
          totalFileSize = parseFloat(resp.headers['content-length']);
        }
      }

      let previousProgressValue = -1;
      resp.on('data', chunk => {
        progress += chunk.length;
        const progressValue = (progress * 100) / totalFileSize;

        if (progressValue === 100 || progressValue - previousProgressValue > 1) {
          previousProgressValue = progressValue;
          taskUtil.setTaskProgress(modelId, progressValue);
        }

        // send progress in percentage (ex. 1.2%, 2.6%, 80.1%) to frontend
        //this.sendProgress(progressValue);
        if (progressValue === 100) {
          callback({
            successful: true,
            path: destFile,
          });
        }
      });
      file.on('finish', () => {
        file.close();
      });
      file.on('error', e => {
        callback({
          successful: false,
          error: e.message,
        });
      });
      resp.pipe(file);
    });
  }
}
