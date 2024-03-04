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
import { type Webview, fs as apiFs, type Disposable } from '@podman-desktop/api';
import { MSG_NEW_MODELS_STATE } from '@shared/Messages';
import type { CatalogManager } from './catalogManager';
import type { ModelInfo } from '@shared/src/models/IModelInfo';
import * as podmanDesktopApi from '@podman-desktop/api';
import { Downloader, type DownloadEvent, isCompletionEvent, isProgressEvent } from '../utils/downloader';
import type { TaskRegistry } from '../registries/TaskRegistry';
import type { Task } from '@shared/src/models/ITask';

export class ModelsManager implements Disposable {
  #modelsDir: string;
  #models: Map<string, ModelInfo>;
  #watcher?: podmanDesktopApi.FileSystemWatcher;

  #downloaders: Map<string, Downloader> = new Map<string, Downloader>();

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

  /**
   * This method will resolve when the provided model will be downloaded.
   *
   * This can method can be call multiple time for the same model, it will reuse existing downloader and wait on
   * their completion.
   * @param model
   * @param labels
   */
  async requestDownloadModel(model: ModelInfo, labels?: { [key: string]: string }): Promise<string> {
    // Create a task to follow progress
    const task: Task = this.createDownloadTask(model, labels);

    // Check there is no existing downloader running
    if (!this.#downloaders.has(model.id)) {
      return this.downloadModel(model, task);
    }

    const existingDownloader = this.#downloaders.get(model.id);
    if (existingDownloader.completed) {
      task.state = 'success';
      this.taskRegistry.updateTask(task);

      return existingDownloader.getTarget();
    }

    // If we have an existing downloader running we subscribe on its events
    return new Promise((resolve, reject) => {
      const disposable = existingDownloader.onEvent(event => {
        if (!isCompletionEvent(event)) return;

        switch (event.status) {
          case 'completed':
            resolve(existingDownloader.getTarget());
            break;
          default:
            reject(new Error(event.message));
        }
        disposable.dispose();
      });
    });
  }

  private onDownloadEvent(event: DownloadEvent): void {
    // Always use the task registry as source of truth for tasks
    const tasks = this.taskRegistry.getTasksByLabels({ 'model-pulling': event.id });
    if (tasks.length === 0) {
      // tasks might have been cleared but still an error.
      console.error('received download event but no task is associated.');
      return;
    }

    console.log(`onDownloadEvent updating ${tasks.length} tasks.`);

    tasks.forEach(task => {
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
            'model.id': event.id,
            message: 'error downloading model',
            error: event.message,
            durationSeconds: event.duration,
          });
        } else {
          task.state = 'success';
          task.progress = 100;

          // telemetry usage
          this.telemetry.logUsage('model.download', { 'model.id': event.id, durationSeconds: event.duration });
        }
      }
      this.taskRegistry.updateTask(task); // update task
    });
  }

  private createDownloader(model: ModelInfo): Downloader {
    console.log('Creating a downloader.');

    // Ensure path to model directory exist
    const destDir = path.join(this.appUserDirectory, 'models', model.id);
    if (!fs.existsSync(destDir)) {
      fs.mkdirSync(destDir, { recursive: true });
    }

    const target = path.resolve(destDir, path.basename(model.url));
    // Create a downloader
    const downloader = new Downloader(model.url, target);

    this.#downloaders.set(model.id, downloader);

    return downloader;
  }

  private createDownloadTask(model: ModelInfo, labels?: { [key: string]: string }): Task {
    return this.taskRegistry.createTask(`Downloading model ${model.name}`, 'loading', {
      ...labels,
      'model-pulling': model.id,
    });
  }

  private async downloadModel(model: ModelInfo, task: Task): Promise<string> {
    // Check if the model is already on disk.
    if (this.isModelOnDisk(model.id)) {
      task.state = 'success';
      task.name = `Model ${model.name} already present on disk`;
      this.taskRegistry.updateTask(task); // update task

      // return model path
      return this.getLocalModelPath(model.id);
    }

    // update task to loading state
    this.taskRegistry.updateTask(task);

    const downloader = this.createDownloader(model);

    // Capture downloader events
    downloader.onEvent(this.onDownloadEvent.bind(this));

    // perform download
    await downloader.perform(model.id);
    return downloader.getTarget();
  }
}
