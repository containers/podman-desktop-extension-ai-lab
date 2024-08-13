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
import type { GitCloneInfo, GitManager } from '../gitManager';
import type { TaskRegistry } from '../../registries/TaskRegistry';
import type { Recipe, RecipeImage } from '@shared/src/models/IRecipe';
import path from 'node:path';
import type { Task } from '@shared/src/models/ITask';
import type { LocalRepositoryRegistry } from '../../registries/LocalRepositoryRegistry';
import type { AIConfig, AIConfigFile, ContainerConfig } from '../../models/AIConfig';
import { parseYamlFile } from '../../models/AIConfig';
import { existsSync, statSync } from 'node:fs';
import { goarch } from '../../utils/arch';
import type { BuilderManager } from './BuilderManager';
import type { ContainerProviderConnection, Disposable } from '@podman-desktop/api';
import { CONFIG_FILENAME } from '../../utils/RecipeConstants';

export interface AIContainers {
  aiConfigFile: AIConfigFile;
  containers: ContainerConfig[];
}

export class RecipeManager implements Disposable {
  constructor(
    private appUserDirectory: string,
    private git: GitManager,
    private taskRegistry: TaskRegistry,
    private builderManager: BuilderManager,
    private localRepositories: LocalRepositoryRegistry,
  ) {}

  dispose(): void {}

  init(): void {}

  private async doCheckout(gitCloneInfo: GitCloneInfo, labels?: { [id: string]: string }): Promise<void> {
    // Creating checkout task
    const checkoutTask: Task = this.taskRegistry.createTask('Checking out repository', 'loading', {
      ...labels,
      git: 'checkout',
    });

    try {
      await this.git.processCheckout(gitCloneInfo);
      checkoutTask.state = 'success';
    } catch (err: unknown) {
      checkoutTask.state = 'error';
      checkoutTask.error = String(err);
      // propagate error
      throw err;
    } finally {
      // Update task registry
      this.taskRegistry.updateTask(checkoutTask);
    }
  }

  public async cloneRecipe(recipe: Recipe, labels?: { [key: string]: string }): Promise<void> {
    const localFolder = path.join(this.appUserDirectory, recipe.id);

    // clone the recipe repository on the local folder
    const gitCloneInfo: GitCloneInfo = {
      repository: recipe.repository,
      ref: recipe.ref,
      targetDirectory: localFolder,
    };
    await this.doCheckout(gitCloneInfo, {
      ...labels,
      'recipe-id': recipe.id,
    });

    this.localRepositories.register({
      path: gitCloneInfo.targetDirectory,
      sourcePath: path.join(gitCloneInfo.targetDirectory, recipe.basedir ?? ''),
      labels: {
        'recipe-id': recipe.id,
      },
    });
  }

  public async buildRecipe(
    connection: ContainerProviderConnection,
    recipe: Recipe,
    labels?: { [key: string]: string },
  ): Promise<RecipeImage[]> {
    const localFolder = path.join(this.appUserDirectory, recipe.id);

    // load and parse the recipe configuration file and filter containers based on architecture
    const configAndFilteredContainers = this.getConfigAndFilterContainers(recipe.basedir, localFolder, {
      ...labels,
      'recipe-id': recipe.id,
    });

    return await this.builderManager.build(
      connection,
      recipe,
      configAndFilteredContainers.containers,
      configAndFilteredContainers.aiConfigFile.path,
      {
        ...labels,
        'recipe-id': recipe.id,
      },
    );
  }

  private getConfigAndFilterContainers(
    recipeBaseDir: string | undefined,
    localFolder: string,
    labels?: { [key: string]: string },
  ): AIContainers {
    // Adding loading configuration task
    const task = this.taskRegistry.createTask('Loading configuration', 'loading', labels);

    let aiConfigFile: AIConfigFile;
    try {
      // load and parse the recipe configuration file
      aiConfigFile = this.getConfiguration(recipeBaseDir, localFolder);
    } catch (e) {
      task.error = `Something went wrong while loading configuration: ${String(e)}.`;
      this.taskRegistry.updateTask(task);
      throw e;
    }

    // filter the containers based on architecture, gpu accelerator and backend (that define which model supports)
    const filteredContainers: ContainerConfig[] = this.filterContainers(aiConfigFile.aiConfig);
    if (filteredContainers.length > 0) {
      // Mark as success.
      task.state = 'success';
      this.taskRegistry.updateTask(task);
    } else {
      // Mark as failure.
      task.error = 'No containers available.';
      this.taskRegistry.updateTask(task);
      throw new Error('No containers available.');
    }

    return {
      aiConfigFile: aiConfigFile,
      containers: filteredContainers,
    };
  }

  private filterContainers(aiConfig: AIConfig): ContainerConfig[] {
    return aiConfig.application.containers.filter(
      container => container.gpu_env.length === 0 && container.arch.some(arc => arc === goarch()),
    );
  }

  private getConfiguration(recipeBaseDir: string | undefined, localFolder: string): AIConfigFile {
    let configFile: string;
    if (recipeBaseDir !== undefined) {
      configFile = path.join(localFolder, recipeBaseDir, CONFIG_FILENAME);
    } else {
      configFile = path.join(localFolder, CONFIG_FILENAME);
    }

    if (!existsSync(configFile)) {
      throw new Error(`The file located at ${configFile} does not exist.`);
    }

    // If the user configured the config as a directory we check for "ai-lab.yaml" inside.
    if (statSync(configFile).isDirectory()) {
      const tmpPath = path.join(configFile, CONFIG_FILENAME);
      // If it has the ai-lab.yaml we use it.
      if (existsSync(tmpPath)) {
        configFile = tmpPath;
      }
    }

    // Parsing the configuration
    console.log(`Reading configuration from ${configFile}.`);
    let aiConfig: AIConfig;
    try {
      aiConfig = parseYamlFile(configFile, goarch());
    } catch (err) {
      console.error('Cannot load configure file.', err);
      throw new Error(`Cannot load configuration file.`);
    }

    // Mark as success.
    return {
      aiConfig,
      path: configFile,
    };
  }
}
