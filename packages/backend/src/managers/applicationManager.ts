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

import type { Recipe } from '@shared/src/models/IRecipe';
import { arch } from 'node:os';
import type { GitManager } from './gitManager';
import fs from 'fs';
import * as https from 'node:https';
import * as path from 'node:path';
import { containerEngine } from '@podman-desktop/api';
import type { RecipeStatusRegistry } from '../registries/RecipeStatusRegistry';
import type { AIConfig, AIConfigFile, ContainerConfig } from '../models/AIConfig';
import { parseYaml } from '../models/AIConfig';
import type { Task } from '@shared/src/models/ITask';
import { RecipeStatusUtils } from '../utils/recipeStatusUtils';
import { getParentDirectory } from '../utils/pathUtils';
import type { ModelInfo } from '@shared/src/models/IModelInfo';
import type { ModelsManager } from './modelsManager';

export const CONFIG_FILENAME = 'ai-studio.yaml';

interface DownloadModelResult {
  result: 'ok' | 'failed';
  error?: string;
}

interface AIContainers {
  aiConfigFile: AIConfigFile;
  containers: ContainerConfig[];
}

export class ApplicationManager {
  constructor(
    private appUserDirectory: string,
    private git: GitManager,
    private recipeStatusRegistry: RecipeStatusRegistry,
    private modelsManager: ModelsManager,
  ) {}

  async pullApplication(recipe: Recipe, model: ModelInfo) {
    // Create a TaskUtils object to help us
    const taskUtil = new RecipeStatusUtils(recipe.id, this.recipeStatusRegistry);

    const localFolder = path.join(this.appUserDirectory, recipe.id);

    // clone the recipe repository on the local folder
    await this.doCheckout(recipe.repository, localFolder, taskUtil);

    const configAndFilteredContainers = this.getConfigAndFilterContainers(recipe.config, localFolder, taskUtil);

    // get model by downloading it or retrieving locally
    await this.downloadModel(model, taskUtil);

    // build all images, one per container (for a basic sample we should have 2 containers = sample app + model service)
    await this.buildImages(configAndFilteredContainers.containers, configAndFilteredContainers.aiConfigFile.path, taskUtil);    
  }

  async buildImages(filteredContainers: ContainerConfig[], configPath: string, taskUtil: RecipeStatusUtils) {
    filteredContainers.forEach(container => {
      taskUtil.setTask({
        id: container.name,
        state: 'loading',
        name: `Building ${container.name}`,
      });
    });

    // Promise all the build images
    await Promise.all(
      filteredContainers.map(container => {
        // We use the parent directory of our configFile as the rootdir, then we append the contextDir provided
        const context = path.join(getParentDirectory(configPath), container.contextdir);
        console.log(`Application Manager using context ${context} for container ${container.name}`);

        // Ensure the context provided exist otherwise throw an Error
        if (!fs.existsSync(context)) {
          console.error('The context provided does not exist.');
          taskUtil.setTaskState(container.name, 'error');
          throw new Error('Context configured does not exist.');
        }

        let isErrored = false;

        const buildOptions = {
          containerFile: container.containerfile,
          tag: `${container.name}:latest`,
        };

        return containerEngine
          .buildImage(
            context,
            (event, data) => {
              // todo: do something with the event
              if (event === 'error' || (event === 'finish' && data !== '')) {
                console.error('Something went wrong while building the image: ', data);
                taskUtil.setTaskState(container.name, 'error');
                isErrored = true;
              }
              if (event === 'finish' && !isErrored) {
                taskUtil.setTaskState(container.name, 'success');
              }
            },
            buildOptions,
          )
          .catch((err: unknown) => {
            console.error('Something went wrong while building the image: ', err);
            taskUtil.setTaskState(container.name, 'error');
          });
      }),
    );
  }

  getConfigAndFilterContainers(recipeConfig: string, localFolder: string, taskUtil: RecipeStatusUtils): AIContainers {
    // Adding loading configuration task
    const loadingConfiguration: Task = {
      id: 'loading-config',
      name: 'Loading configuration',
      state: 'loading',
    };
    taskUtil.setTask(loadingConfiguration);

    let aiConfigFile: AIConfigFile;
    try {
      // load and parse the recipe configuration file
      aiConfigFile = this.getConfiguration(recipeConfig, localFolder);  
    } catch(e) {
      loadingConfiguration.state = 'error';
      taskUtil.setTask(loadingConfiguration);
      throw e
    }

    // filter the containers based on architecture, gpu accelerator and backend (that define which model supports)
    const filteredContainers: ContainerConfig[] = this.filterContainers(aiConfigFile.aiConfig);
    if (filteredContainers.length > 0) {
      // Mark as success.
      loadingConfiguration.state = 'success';
      taskUtil.setTask(loadingConfiguration);
    } else {
      // Mark as failure.
      loadingConfiguration.state = 'error';
      taskUtil.setTask(loadingConfiguration);
      throw new Error('No containers available.');
    }

    return {
      aiConfigFile: aiConfigFile,
      containers: filteredContainers,
    };
  }

  filterContainers(aiConfig: AIConfig): ContainerConfig[] {
    return aiConfig.application.containers.filter(
      container => container.arch === undefined || container.arch === arch(),
    );
  }

  async downloadModel(model: ModelInfo, taskUtil: RecipeStatusUtils) {
    if (!this.modelsManager.isModelOnDisk(model.id)) {
      // Download model
      taskUtil.setTask({
        id: model.id,
        state: 'loading',
        name: `Downloading model ${model.name}`,
        labels: {
          'model-pulling': model.id,
        },
      });

      await this.doDownloadModelWrapper(model.id, model.url, taskUtil);
    } else {
      taskUtil.setTask({
        id: model.id,
        state: 'success',
        name: `Model ${model.name} already present on disk`,
        labels: {
          'model-pulling': model.id,
        },
      });
    }
  }

  getConfiguration(recipeConfig: string, localFolder: string): AIConfigFile {
    let configFile: string;
    if (recipeConfig !== undefined) {
      configFile = path.join(localFolder, recipeConfig);
    } else {
      configFile = path.join(localFolder, CONFIG_FILENAME);
    }

    if (!fs.existsSync(configFile)) {      
      throw new Error(`The file located at ${configFile} does not exist.`);
    }

    // If the user configured the config as a directory we check for "ai-studio.yaml" inside.
    if (fs.statSync(configFile).isDirectory()) {
      const tmpPath = path.join(configFile, CONFIG_FILENAME);
      // If it has the ai-studio.yaml we use it.
      if (fs.existsSync(tmpPath)) {
        configFile = tmpPath;
      }
    }

    // Parsing the configuration
    console.log(`Reading configuration from ${configFile}.`);
    const rawConfiguration = fs.readFileSync(configFile, 'utf-8');
    let aiConfig: AIConfig;
    try {
      aiConfig = parseYaml(rawConfiguration, arch());
    } catch (err) {
      throw new Error('Cannot load configuration file.');
    }

    // Mark as success.
    return {
      aiConfig,
      path: configFile,
    }
  }

  async doCheckout(repository: string, localFolder: string, taskUtil: RecipeStatusUtils) {
    // Adding checkout task
    const checkoutTask: Task = {
      id: 'checkout',
      name: 'Checkout repository',
      state: 'loading',
      labels: {
        git: 'checkout',
      },
    };
    taskUtil.setTask(checkoutTask);

    // We might already have the repository cloned
    if (fs.existsSync(localFolder) && fs.statSync(localFolder).isDirectory()) {
      // Update checkout state
      checkoutTask.name = 'Checkout repository (cached).';
      checkoutTask.state = 'success';
    } else {
      // Create folder
      fs.mkdirSync(localFolder, { recursive: true });

      // Clone the repository
      console.log(`Cloning repository ${repository} in ${localFolder}.`);
      await this.git.cloneRepository(repository, localFolder);

      // Update checkout state
      checkoutTask.state = 'success';
    }
    // Update task
    taskUtil.setTask(checkoutTask);
  }

  doDownloadModelWrapper(modelId: string, url: string, taskUtil: RecipeStatusUtils, destFileName?: string): Promise<string> {
    return new Promise((resolve, reject) => {
      const downloadCallback = (result: DownloadModelResult) => {
        if (result.result) {
          taskUtil.setTaskState(modelId, 'success');
          resolve('');
        } else {
          taskUtil.setTaskState(modelId, 'error');
          reject(result.error);
        }
      };

      if (fs.existsSync(destFileName)) {
        taskUtil.setTaskState(modelId, 'success');
        taskUtil.setTaskProgress(modelId, 100);
        return;
      }

      this.doDownloadModel(modelId, url, taskUtil, downloadCallback, destFileName);
    });
  }

  private doDownloadModel(
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
            result: 'ok',
          });
        }
      });
      file.on('finish', () => {
        file.close();
      });
      file.on('error', e => {
        callback({
          result: 'failed',
          error: e.message,
        });
      });
      resp.pipe(file);
    });
  }
}
