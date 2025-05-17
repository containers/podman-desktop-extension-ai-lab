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

import type { LocalModelInfo } from '@shared/models/ILocalModelInfo';
import fs from 'node:fs';
import * as path from 'node:path';
import { type Disposable, env, type ContainerProviderConnection } from '@podman-desktop/api';
import { MSG_NEW_MODELS_STATE } from '@shared/Messages';
import type { CatalogManager } from './catalogManager';
import type { ModelInfo } from '@shared/models/IModelInfo';
import * as podmanDesktopApi from '@podman-desktop/api';
import type { Downloader } from '../utils/downloader';
import type { TaskRegistry } from '../registries/TaskRegistry';
import type { Task } from '@shared/models/ITask';
import type { BaseEvent } from '../models/baseEvent';
import { isCompletionEvent, isProgressEvent } from '../models/baseEvent';
import { Uploader } from '../utils/uploader';
import { deleteRemoteModel, getLocalModelFile, isModelUploaded } from '../utils/modelsUtils';
import { getPodmanMachineName } from '../utils/podman';
import type { CancellationTokenRegistry } from '../registries/CancellationTokenRegistry';
import { getHash, hasValidSha } from '../utils/sha';
import type { GGUFParseOutput } from '@huggingface/gguf';
import { gguf } from '@huggingface/gguf';
import type { PodmanConnection } from './podmanConnection';
import { VMType } from '@shared/models/IPodman';
import type { ConfigurationRegistry } from '../registries/ConfigurationRegistry';
import type { ModelHandlerRegistry } from '../registries/ModelHandlerRegistry';
import type { RpcExtension } from '@shared/messages/MessageProxy';

export class ModelsManager implements Disposable {
  #models: Map<string, ModelInfo>;
  #disposables: Disposable[];

  #downloaders: Map<string, Downloader> = new Map<string, Downloader>();

  constructor(
    private rpcExtension: RpcExtension,
    private catalogManager: CatalogManager,
    private telemetry: podmanDesktopApi.TelemetryLogger,
    private taskRegistry: TaskRegistry,
    private cancellationTokenRegistry: CancellationTokenRegistry,
    private podmanConnection: PodmanConnection,
    private configurationRegistry: ConfigurationRegistry,
    private modelHandlerRegistry: ModelHandlerRegistry,
  ) {
    this.#models = new Map();
    this.#disposables = [];
    this.modelHandlerRegistry.getAll().forEach(handler => handler.onUpdate(this.loadLocalModels));
  }

  init(): void {
    const disposable = this.catalogManager.onUpdate(() => {
      this.loadLocalModels().catch((err: unknown) => {
        console.error(`Something went wrong when loading local models`, err);
      });
    });
    this.#disposables.push(disposable);

    this.loadLocalModels().catch((err: unknown) => {
      console.error('Something went wrong while trying to load local models', err);
    });
  }

  dispose(): void {
    this.#models.clear();
    this.#disposables.forEach(d => d.dispose());
  }

  async loadLocalModels(): Promise<void> {
    this.#models.clear();
    this.catalogManager.getModels().forEach(m => this.#models.set(m.id, m));
    const reloadLocalModels = async (): Promise<void> => {
      await this.getLocalModelsFromDisk();
      await this.sendModelsInfo();
    };
    // Initialize the local models manually
    await reloadLocalModels();
  }

  getModelsInfo(): ModelInfo[] {
    return [...this.#models.values()];
  }

  async sendModelsInfo(): Promise<void> {
    const models = this.getModelsInfo();
    await this.rpcExtension.fire(MSG_NEW_MODELS_STATE, models);
  }

  async getLocalModelsFromDisk(): Promise<void> {
    return Promise.all(this.modelHandlerRegistry.getAll().map(registry => registry.getLocalModelsFromDisk())).then(
      () => void 0,
    );
  }

  isModelOnDisk(modelId: string): boolean {
    return this.#models.get(modelId)?.file !== undefined;
  }

  getLocalModelInfo(modelId: string): LocalModelInfo {
    const model = this.#models.get(modelId);
    if (!model?.file) {
      throw new Error('model is not on disk');
    }
    return model.file;
  }

  getModelInfo(modelId: string): ModelInfo {
    const model = this.#models.get(modelId);
    if (!model) {
      throw new Error('model is not loaded');
    }
    return model;
  }

  getLocalModelPath(modelId: string): string {
    return getLocalModelFile(this.getModelInfo(modelId));
  }

  async deleteModel(modelId: string): Promise<void> {
    const model = this.#models.get(modelId);
    if (!model?.file) {
      throw new Error('model cannot be found.');
    }

    model.state = 'deleting';
    await this.sendModelsInfo();
    try {
      await this.deleteRemoteModel(model);
      // if model does not have any url, it has been imported locally by the user
      if (!model.url) {
        const modelPath = path.join(model.file.path, model.file.file);
        // remove it from the catalog as it cannot be downloaded anymore
        await this.catalogManager.removeUserModel(modelId);
        await fs.promises.rm(modelPath, { recursive: true, force: true, maxRetries: 3 });
      } else {
        const modelHandler = this.modelHandlerRegistry.findModelHandler(model.url);
        if (!modelHandler) {
          throw new Error(`no model registry found for model ${model.id} url ${model.url}`);
        }
        await modelHandler.deleteModel(model);
      }

      this.telemetry.logUsage('model.delete', { 'model.id': getHash(modelId) });
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
      await this.getLocalModelsFromDisk();
    } finally {
      await this.sendModelsInfo();
    }
  }

  private async deleteRemoteModel(modelInfo: ModelInfo): Promise<void> {
    // currently only Window is supported
    if (!env.isWindows) {
      return;
    }

    // get all container provider connections
    const connections = this.podmanConnection.getContainerProviderConnections();

    // iterate over all connections
    for (const connection of connections) {
      // ignore non-wsl machines
      if (connection.vmType !== VMType.WSL) continue;
      // Get the corresponding machine name
      const machineName = getPodmanMachineName(connection);

      // check if model already loaded on the podman machine
      const existsRemote = await isModelUploaded(machineName, modelInfo);
      if (!existsRemote) return;

      await deleteRemoteModel(machineName, modelInfo);
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
    const existingDownloader = this.#downloaders.get(model.id);
    if (!existingDownloader) {
      return this.downloadModel(model, task);
    }

    if (existingDownloader.completed) {
      task.state = 'success';
      this.taskRegistry.updateTask(task);

      return existingDownloader.getTarget();
    }

    // Propagate cancellation token from existing task to the new one
    task.cancellationToken = this.taskRegistry.findTaskByLabels({ 'model-pulling': model.id })?.cancellationToken;
    this.taskRegistry.updateTask(task);

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

  private async onDownloadUploadEvent(event: BaseEvent, action: 'download' | 'upload'): Promise<void> {
    let taskLabel = 'model-pulling';
    let eventName = 'model.download';
    if (action === 'upload') {
      taskLabel = 'model-uploading';
      eventName = 'model.upload';
    }
    // Always use the task registry as source of truth for tasks
    const tasks = this.taskRegistry.getTasksByLabels({ [taskLabel]: event.id });
    if (tasks.length === 0) {
      // tasks might have been cleared but still an error.
      console.error(`received ${action} event but no task is associated.`);
      return;
    }

    for (const task of tasks) {
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
          this.telemetry.logError(eventName, {
            'model.id': event.id,
            message: `error ${action}ing model`,
            error: event.message,
            durationSeconds: event.duration,
          });
        } else {
          task.state = 'success';
          task.progress = 100;

          // telemetry usage
          this.telemetry.logUsage(eventName, { 'model.id': event.id, durationSeconds: event.duration });
        }

        // cleanup downloader
        this.#downloaders.delete(event.id);
      }
      this.taskRegistry.updateTask(task); // update task
    }
  }

  public createDownloader(model: ModelInfo, abortSignal: AbortSignal): Downloader {
    if (!model.url) {
      throw new Error(`model ${model.id} does not have url defined.`);
    }

    const modelHandler = this.modelHandlerRegistry.findModelHandler(model.url);
    if (!modelHandler) {
      throw new Error(`no model registry found for model ${model.id} url ${model.url}`);
    }

    // Create a downloader
    const downloader = modelHandler.createDownloader(model, abortSignal);
    this.#downloaders.set(model.id, downloader);

    return downloader;
  }

  private createDownloadTask(model: ModelInfo, labels?: { [key: string]: string }): Task {
    // it may happen that the taskRegistry contains old entries representing an old failing download, we delete them as we are starting a new download
    const failedPullingTaskIds = this.taskRegistry
      .getTasksByLabels({
        'model-pulling': model.id,
      })
      .filter(t => t.state === 'error')
      .map(t => t.id);
    if (failedPullingTaskIds.length > 0) {
      this.taskRegistry.deleteAll(failedPullingTaskIds);
    }
    return this.taskRegistry.createTask(`Downloading model ${model.name}`, 'loading', {
      ...labels,
      'model-pulling': model.id,
    });
  }

  private async downloadModel(model: ModelInfo, task: Task): Promise<string> {
    // Check if the model is already on disk.
    if (this.isModelOnDisk(model.id)) {
      task.name = `Model ${model.name} already present on disk`;

      const modelPath = this.getLocalModelPath(model.id);
      if (model.sha256) {
        const isValid = await hasValidSha(modelPath, model.sha256);
        if (!isValid) {
          task.state = 'error';
          task.error = `Model ${model.name} is already present on disk at ${modelPath} but its security hash (SHA-256) does not match the expected value. This may indicate the file has been altered or corrupted. Please delete it and try again.`;
          this.taskRegistry.updateTask(task); // update task
          throw new Error(
            `Model ${model.name} is already present on disk at ${modelPath} but its security hash (SHA-256) does not match the expected value. This may indicate the file has been altered or corrupted. Please delete it and try again.`,
          );
        }
      }

      task.state = 'success';
      this.taskRegistry.updateTask(task); // update task

      // return model path
      return modelPath;
    }

    const abortController = new AbortController();
    task.cancellationToken = this.cancellationTokenRegistry.createCancellationTokenSource(() => {
      abortController.abort('Cancel');
    });

    // update task to loading state
    this.taskRegistry.updateTask(task);

    const downloader = this.createDownloader(model, abortController.signal);

    // Capture downloader events
    downloader.onEvent(event => this.onDownloadUploadEvent(event, 'download'), this);

    // perform download
    await downloader.perform(model.id);
    await this.updateModelInfos();

    return downloader.getTarget();
  }

  async uploadModelToPodmanMachine(
    connection: ContainerProviderConnection,
    model: ModelInfo,
    labels?: { [key: string]: string },
  ): Promise<string> {
    console.log('[ModelsManager] upload model', model);

    // ensure the model upload is not disabled
    if (this.configurationRegistry.getExtensionConfiguration().modelUploadDisabled) {
      console.warn('The model upload is disabled, this may cause the inference server to take a few minutes to start.');
      return getLocalModelFile(model);
    }

    this.taskRegistry.createTask(`Copying model ${model.name} to ${connection.name}`, 'loading', {
      ...labels,
      'model-uploading': model.id,
      connection: connection.name,
    });

    const uploader = new Uploader(connection, model);
    uploader.onEvent(event => this.onDownloadUploadEvent(event, 'upload'), this);

    // perform download
    const path = uploader.perform(model.id);
    console.log('[ModelsManager] path got', path);
    await this.updateModelInfos();

    return path;
  }

  private async updateModelInfos(): Promise<void> {
    // refresh model lists on event completion
    await this.getLocalModelsFromDisk();
    this.sendModelsInfo().catch((err: unknown) => {
      console.error('Something went wrong while sending models info.', err);
    });
  }

  async getModelMetadata(modelId: string): Promise<Record<string, unknown>> {
    const model = this.#models.get(modelId);
    if (!model) throw new Error(`model with id ${modelId} does not exists.`);

    const before = performance.now();
    const data: Record<string, unknown> = {
      'model-id': getHash(modelId),
    };

    try {
      let result: GGUFParseOutput<{ strict: false }>;
      if (this.isModelOnDisk(modelId)) {
        const modelPath = path.normalize(getLocalModelFile(model));
        result = await gguf(modelPath, { allowLocalFile: true });
      } else if (model.url) {
        result = await gguf(model.url);
      } else {
        throw new Error('cannot get model metadata');
      }
      return result.metadata;
    } catch (err: unknown) {
      data['error'] = err;
      console.error(err);
      throw err;
    } finally {
      data['duration'] = performance.now() - before;
      this.telemetry.logUsage('get-metadata', data);
    }
  }
}
