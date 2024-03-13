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
import type { GitCloneInfo, GitManager } from './gitManager';
import fs from 'fs';
import * as path from 'node:path';
import {
  type PodCreatePortOptions,
  containerEngine,
  type TelemetryLogger,
  type PodInfo,
  type Webview,
} from '@podman-desktop/api';
import type { AIConfig, AIConfigFile, ContainerConfig } from '../models/AIConfig';
import { parseYamlFile } from '../models/AIConfig';
import type { Task } from '@shared/src/models/ITask';
import { getParentDirectory } from '../utils/pathUtils';
import type { ModelInfo } from '@shared/src/models/IModelInfo';
import type { ModelsManager } from './modelsManager';
import { getPortsInfo } from '../utils/ports';
import { goarch } from '../utils/arch';
import { getDurationSecondsSince, timeout } from '../utils/utils';
import type { LocalRepositoryRegistry } from '../registries/LocalRepositoryRegistry';
import { LABEL_MODEL_ID, LABEL_MODEL_PORTS } from './playground';
import type { ApplicationState } from '@shared/src/models/IApplicationState';
import type { PodmanConnection } from './podmanConnection';
import { Messages } from '@shared/Messages';
import type { CatalogManager } from './catalogManager';
import { ApplicationRegistry } from '../registries/ApplicationRegistry';
import type { TaskRegistry } from '../registries/TaskRegistry';
import { Publisher } from '../utils/Publisher';

export const LABEL_RECIPE_ID = 'ai-studio-recipe-id';
export const LABEL_APP_PORTS = 'ai-studio-app-ports';

export const CONFIG_FILENAME = 'ai-studio.yaml';

interface AIContainers {
  aiConfigFile: AIConfigFile;
  containers: ContainerConfig[];
}

export interface ContainerAttachedInfo {
  name: string;
  modelService: boolean;
  ports: string[];
}

export interface ApplicationPodInfo {
  engineId: string;
  Id: string;
  containers?: ContainerAttachedInfo[];
  portmappings: PodCreatePortOptions[];
}

export interface ImageInfo {
  id: string;
  modelService: boolean;
  ports: string[];
  appName: string;
}

export class ApplicationManager extends Publisher<ApplicationState[]> {
  #applications: ApplicationRegistry<ApplicationState>;
  protectTasks: Set<string> = new Set();

  constructor(
    private appUserDirectory: string,
    private git: GitManager,
    private taskRegistry: TaskRegistry,
    webview: Webview,
    private podmanConnection: PodmanConnection,
    private catalogManager: CatalogManager,
    private modelsManager: ModelsManager,
    private telemetry: TelemetryLogger,
    private localRepositories: LocalRepositoryRegistry,
  ) {
    super(webview, Messages.MSG_APPLICATIONS_STATE_UPDATE, () => this.getApplicationsState());
    this.#applications = new ApplicationRegistry<ApplicationState>();
  }

  async pullApplication(recipe: Recipe, model: ModelInfo) {
    // clear any existing status / tasks related to the pair recipeId-modelId.
    this.taskRegistry.deleteByLabels({
      'recipe-id': recipe.id,
      'model-id': model.id,
    });
    return this.startApplication(recipe, model);
  }

  async startApplication(recipe: Recipe, model: ModelInfo) {
    // const recipeStatus = this.recipeStatusRegistry.
    const startTime = performance.now();
    try {
      const localFolder = path.join(this.appUserDirectory, recipe.id);

      // clone the recipe repository on the local folder
      const gitCloneInfo: GitCloneInfo = {
        repository: recipe.repository,
        ref: recipe.ref,
        targetDirectory: localFolder,
      };
      await this.doCheckout(gitCloneInfo, {
        'recipe-id': recipe.id,
        'model-id': model.id,
      });

      this.localRepositories.register({
        path: gitCloneInfo.targetDirectory,
        labels: {
          'recipe-id': recipe.id,
        },
      });

      // load and parse the recipe configuration file and filter containers based on architecture, gpu accelerator
      // and backend (that define which model supports)
      const configAndFilteredContainers = this.getConfigAndFilterContainers(recipe.config, localFolder);

      // get model by downloading it or retrieving locally
      let modelPath = await this.modelsManager.requestDownloadModel(model, {
        'recipe-id': recipe.id,
        'model-id': model.id,
      });

      // upload model to podman machine if user system is supported
      modelPath = await this.modelsManager.uploadModelToPodmanMachine(model, modelPath, {
        'recipe-id': recipe.id,
        'model-id': model.id,
      });


      // build all images, one per container (for a basic sample we should have 2 containers = sample app + model service)
      const images = await this.buildImages(
        recipe,
        configAndFilteredContainers.containers,
        configAndFilteredContainers.aiConfigFile.path,
        {
          'recipe-id': recipe.id,
          'model-id': model.id,
        },
      );

      // first delete any existing pod with matching labels
      if (await this.hasApplicationPod(recipe.id, model.id)) {
        await this.deleteApplication(recipe.id, model.id);
      }

      // create a pod containing all the containers to run the application
      const podInfo = await this.createApplicationPod(recipe, model, images, modelPath, {
        'recipe-id': recipe.id,
        'model-id': model.id,
      });

      await this.runApplication(podInfo, {
        'recipe-id': recipe.id,
        'model-id': model.id,
      });
      const durationSeconds = getDurationSecondsSince(startTime);
      this.telemetry.logUsage('recipe.pull', { 'recipe.id': recipe.id, 'recipe.name': recipe.name, durationSeconds });
    } catch (err: unknown) {
      const durationSeconds = getDurationSecondsSince(startTime);
      this.telemetry.logError('recipe.pull', {
        'recipe.id': recipe.id,
        'recipe.name': recipe.name,
        durationSeconds,
        message: 'error pulling application',
        error: err,
      });
      throw err;
    }
  }

  async runApplication(podInfo: ApplicationPodInfo, labels?: { [key: string]: string }) {
    const task = this.taskRegistry.createTask('Starting AI App', 'loading', labels);

    // it starts the pod
    await containerEngine.startPod(podInfo.engineId, podInfo.Id);

    // check if all containers have started successfully
    for (const container of podInfo.containers ?? []) {
      await this.waitContainerIsRunning(podInfo.engineId, container);
    }

    // Update task registry
    this.taskRegistry.updateTask({
      ...task,
      state: 'success',
      name: 'AI App is running',
    });
  }

  async waitContainerIsRunning(engineId: string, container: ContainerAttachedInfo): Promise<void> {
    const TIME_FRAME_MS = 5000;
    const MAX_ATTEMPTS = 60 * (60000 / TIME_FRAME_MS); // try for 1 hour
    for (let i = 0; i < MAX_ATTEMPTS; i++) {
      const sampleAppContainerInspectInfo = await containerEngine.inspectContainer(engineId, container.name);
      if (sampleAppContainerInspectInfo.State.Running) {
        return;
      }
      await timeout(TIME_FRAME_MS);
    }
    throw new Error(`Container ${container.name} not started in time`);
  }

  async createApplicationPod(
    recipe: Recipe,
    model: ModelInfo,
    images: ImageInfo[],
    modelPath: string,
    labels?: { [key: string]: string },
  ): Promise<ApplicationPodInfo> {
    const task = this.taskRegistry.createTask('Creating AI App', 'loading', labels);

    // create empty pod
    let podInfo: ApplicationPodInfo;
    try {
      podInfo = await this.createPod(recipe, model, images);
      task.labels['pod-id'] = podInfo.Id;
    } catch (e) {
      console.error('error when creating pod', e);
      task.state = 'error';
      task.error = `Something went wrong while creating pod: ${String(e)}`;
      throw e;
    } finally {
      this.taskRegistry.updateTask(task);
    }

    let attachedContainers: ContainerAttachedInfo[];
    try {
      attachedContainers = await this.createAndAddContainersToPod(podInfo, images, modelPath);
      task.state = 'success';
    } catch (e) {
      console.error(`error when creating pod ${podInfo.Id}`, e);
      task.state = 'error';
      task.error = `Something went wrong while creating pod: ${String(e)}`;
      throw e;
    } finally {
      this.taskRegistry.updateTask(task);
    }

    podInfo.containers = attachedContainers;
    return podInfo;
  }

  async createAndAddContainersToPod(
    podInfo: ApplicationPodInfo,
    images: ImageInfo[],
    modelPath: string,
  ): Promise<ContainerAttachedInfo[]> {
    const containers: ContainerAttachedInfo[] = [];
    await Promise.all(
      images.map(async image => {
        let hostConfig: unknown;
        let envs: string[] = [];
        // if it's a model service we mount the model as a volume
        if (image.modelService) {
          const modelName = path.basename(modelPath);
          hostConfig = {
            AutoRemove: true,
            Mounts: [
              {
                Target: `/${modelName}`,
                Source: modelPath,
                Type: 'bind',
              },
            ],
          };
          envs = [`MODEL_PATH=/${modelName}`];
        } else {
          hostConfig = {
            AutoRemove: true,
          };
          // TODO: remove static port
          const modelService = images.find(image => image.modelService);
          if (modelService && modelService.ports.length > 0) {
            const endPoint = `http://localhost:${modelService.ports[0]}`;
            envs = [`MODEL_ENDPOINT=${endPoint}`];
          }
        }
        const createdContainer = await containerEngine.createContainer(podInfo.engineId, {
          Image: image.id,
          Detach: true,
          HostConfig: hostConfig,
          Env: envs,
          start: false,
        });

        // now, for each container, put it in the pod
        if (createdContainer) {
          const podifiedName = this.getRandomName(`${image.appName}-podified`);
          await containerEngine.replicatePodmanContainer(
            {
              id: createdContainer.id,
              engineId: podInfo.engineId,
            },
            { engineId: podInfo.engineId },
            { pod: podInfo.Id, name: podifiedName },
          );
          containers.push({
            name: podifiedName,
            modelService: image.modelService,
            ports: image.ports,
          });
          // remove the external container
          await containerEngine.deleteContainer(podInfo.engineId, createdContainer.id);
        } else {
          throw new Error(`failed at creating container for image ${image.id}`);
        }
      }),
    );
    return containers;
  }

  async createPod(recipe: Recipe, model: ModelInfo, images: ImageInfo[]): Promise<ApplicationPodInfo> {
    // find the exposed port of the sample app so we can open its ports on the new pod
    const sampleAppImageInfo = images.find(image => !image.modelService);
    if (!sampleAppImageInfo) {
      console.error('no sample app image found');
      throw new Error('no sample app found');
    }

    const portmappings: PodCreatePortOptions[] = [];
    // N.B: it may not work with ranges
    // we expose all ports so we can check the model service if it is actually running
    for (const image of images) {
      for (const exposed of image.ports) {
        const localPorts = await getPortsInfo(exposed);
        portmappings.push({
          container_port: parseInt(exposed),
          host_port: parseInt(localPorts),
          host_ip: '',
          protocol: '',
          range: 1,
        });
      }
    }

    // create new pod
    const labels = {
      [LABEL_RECIPE_ID]: recipe.id,
      [LABEL_MODEL_ID]: model.id,
    };
    const modelPorts = images.filter(img => img.modelService).flatMap(img => img.ports);
    if (modelPorts.length) {
      labels[LABEL_MODEL_PORTS] = modelPorts.join(',');
    }
    const appPorts = images.filter(img => !img.modelService).flatMap(img => img.ports);
    if (appPorts.length) {
      labels[LABEL_APP_PORTS] = appPorts.join(',');
    }
    const pod = await containerEngine.createPod({
      name: this.getRandomName(`pod-${sampleAppImageInfo.appName}`),
      portmappings: portmappings,
      labels,
    });
    return {
      Id: pod.Id,
      engineId: pod.engineId,
      portmappings: portmappings,
    };
  }

  getRandomName(base: string): string {
    return `${base ?? ''}-${new Date().getTime()}`;
  }

  async buildImages(
    recipe: Recipe,
    containers: ContainerConfig[],
    configPath: string,
    labels?: { [key: string]: string },
  ): Promise<ImageInfo[]> {
    const containerTasks: { [key: string]: Task } = Object.fromEntries(
      containers.map(container => [
        container.name,
        this.taskRegistry.createTask(`Building ${container.name}`, 'loading', labels),
      ]),
    );

    const imageInfoList: ImageInfo[] = [];

    // Promise all the build images
    await Promise.all(
      containers.map(container => {
        const task = containerTasks[container.name];

        // We use the parent directory of our configFile as the rootdir, then we append the contextDir provided
        const context = path.join(getParentDirectory(configPath), container.contextdir);
        console.log(`Application Manager using context ${context} for container ${container.name}`);

        // Ensure the context provided exist otherwise throw an Error
        if (!fs.existsSync(context)) {
          task.error = 'The context provided does not exist.';
          this.taskRegistry.updateTask(task);
          throw new Error('Context configured does not exist.');
        }

        const imageTag = this.getImageTag(recipe, container);
        const buildOptions = {
          containerFile: container.containerfile,
          tag: imageTag,
          labels: {
            [LABEL_RECIPE_ID]: labels !== undefined && 'recipe-id' in labels ? labels['recipe-id'] : undefined,
          },
        };

        return containerEngine
          .buildImage(
            context,
            (event, data) => {
              // todo: do something with the event
              if (event === 'error' || (event === 'finish' && data !== '')) {
                console.error('Something went wrong while building the image: ', data);
                task.error = `Something went wrong while building the image: ${data}`;
                this.taskRegistry.updateTask(task);
              }
            },
            buildOptions,
          )
          .catch((err: unknown) => {
            task.error = `Something went wrong while building the image: ${String(err)}`;
            this.taskRegistry.updateTask(task);
            throw new Error(`Something went wrong while building the image: ${String(err)}`);
          });
      }),
    );

    // after image are built we return their data
    const images = await containerEngine.listImages();
    await Promise.all(
      containers.map(async container => {
        const task = containerTasks[container.name];
        const imageTag = this.getImageTag(recipe, container);

        const image = images.find(im => {
          return im.RepoTags?.some(tag => tag.endsWith(imageTag));
        });

        if (!image) {
          task.error = `no image found for ${container.name}:latest`;
          this.taskRegistry.updateTask(task);
          throw new Error(`no image found for ${container.name}:latest`);
        }

        imageInfoList.push({
          id: image.Id,
          modelService: container.modelService,
          ports: container.ports?.map(p => `${p}`) ?? [],
          appName: container.name,
        });

        task.state = 'success';
        this.taskRegistry.updateTask(task);
      }),
    );

    return imageInfoList;
  }

  private getImageTag(recipe: Recipe, container: ContainerConfig) {
    return `${recipe.id}-${container.name}:latest`;
  }

  getConfigAndFilterContainers(
    recipeConfig: string,
    localFolder: string,
    labels?: { [key: string]: string },
  ): AIContainers {
    // Adding loading configuration task
    const task = this.taskRegistry.createTask('Loading configuration', 'loading', labels);

    let aiConfigFile: AIConfigFile;
    try {
      // load and parse the recipe configuration file
      aiConfigFile = this.getConfiguration(recipeConfig, localFolder);
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

  filterContainers(aiConfig: AIConfig): ContainerConfig[] {
    return aiConfig.application.containers.filter(
      container => container.gpu_env.length === 0 && container.arch.some(arc => arc === goarch()),
    );
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

  async doCheckout(gitCloneInfo: GitCloneInfo, labels?: { [id: string]: string }) {
    // Creating checkout task
    const checkoutTask: Task = this.taskRegistry.createTask('Checking out repository', 'loading', {
      ...labels,
      git: 'checkout',
    });

    try {
      // We might already have the repository cloned
      if (fs.existsSync(gitCloneInfo.targetDirectory) && fs.statSync(gitCloneInfo.targetDirectory).isDirectory()) {
        // Update checkout state
        checkoutTask.name = 'Checking out repository (cached).';
        checkoutTask.state = 'success';
      } else {
        // Create folder
        fs.mkdirSync(gitCloneInfo.targetDirectory, { recursive: true });

        // Clone the repository
        console.log(`Cloning repository ${gitCloneInfo.repository} in ${gitCloneInfo.targetDirectory}.`);
        await this.git.cloneRepository(gitCloneInfo);

        // Update checkout state
        checkoutTask.state = 'success';
      }
    } catch (err: unknown) {
      checkoutTask.state = 'error';
      checkoutTask.error = String(err);
      throw err;
    } finally {
      // Update task registry
      this.taskRegistry.updateTask(checkoutTask);
    }
  }

  adoptRunningApplications() {
    this.podmanConnection.startupSubscribe(() => {
      if (!containerEngine.listPods) {
        // TODO(feloy) this check can be safely removed when podman desktop 1.8 is released
        // and the extension minimal version is set to 1.8
        return;
      }
      containerEngine
        .listPods()
        .then(pods => {
          const appsPods = pods.filter(pod => LABEL_RECIPE_ID in pod.Labels);
          for (const podToAdopt of appsPods) {
            this.adoptPod(podToAdopt);
          }
        })
        .catch((err: unknown) => {
          console.error('error during adoption of existing playground containers', err);
        });
    });

    this.podmanConnection.onMachineStop(() => {
      // Podman Machine has been stopped, we consider all recipe pods are stopped
      for (const recipeModelIndex of this.#applications.keys()) {
        this.taskRegistry.createTask('AI App stopped manually', 'success', {
          'recipe-id': recipeModelIndex.recipeId,
          'model-id': recipeModelIndex.modelId,
        });
      }

      this.#applications.clear();
      this.notify();
    });

    this.podmanConnection.onPodStart((pod: PodInfo) => {
      this.adoptPod(pod);
    });
    this.podmanConnection.onPodStop((pod: PodInfo) => {
      this.forgetPod(pod);
    });
    this.podmanConnection.onPodRemove((podId: string) => {
      this.forgetPodById(podId);
    });
  }

  adoptPod(pod: PodInfo) {
    if (!pod.Labels) {
      return;
    }
    const recipeId = pod.Labels[LABEL_RECIPE_ID];
    const modelId = pod.Labels[LABEL_MODEL_ID];
    const appPorts = this.getPortsFromLabel(pod.Labels, LABEL_APP_PORTS);
    const modelPorts = this.getPortsFromLabel(pod.Labels, LABEL_MODEL_PORTS);
    if (this.#applications.has({ recipeId, modelId })) {
      return;
    }
    const state: ApplicationState = {
      recipeId,
      modelId,
      pod,
      appPorts,
      modelPorts,
    };
    this.updateApplicationState(recipeId, modelId, state);
  }

  forgetPod(pod: PodInfo) {
    if (!pod.Labels) {
      return;
    }
    const recipeId = pod.Labels[LABEL_RECIPE_ID];
    const modelId = pod.Labels[LABEL_MODEL_ID];
    if (!this.#applications.has({ recipeId, modelId })) {
      return;
    }
    this.#applications.delete({ recipeId, modelId });
    this.notify();

    const protect = this.protectTasks.has(pod.Id);
    if (!protect) {
      this.taskRegistry.createTask('AI App stopped manually', 'success', {
        'recipe-id': recipeId,
        'model-id': modelId,
      });
    } else {
      this.protectTasks.delete(pod.Id);
    }
  }

  forgetPodById(podId: string) {
    const app = Array.from(this.#applications.values()).find(p => p.pod.Id === podId);
    if (!app) {
      return;
    }
    if (!app.pod.Labels) {
      return;
    }
    const recipeId = app.pod.Labels[LABEL_RECIPE_ID];
    const modelId = app.pod.Labels[LABEL_MODEL_ID];
    if (!this.#applications.has({ recipeId, modelId })) {
      return;
    }
    this.#applications.delete({ recipeId, modelId });
    this.notify();

    const protect = this.protectTasks.has(podId);
    if (!protect) {
      this.taskRegistry.createTask('AI App stopped manually', 'success', {
        'recipe-id': recipeId,
        'model-id': modelId,
      });
    } else {
      this.protectTasks.delete(podId);
    }
  }

  updateApplicationState(recipeId: string, modelId: string, state: ApplicationState): void {
    this.#applications.set({ recipeId, modelId }, state);
    this.notify();
  }

  getApplicationsState(): ApplicationState[] {
    return Array.from(this.#applications.values());
  }

  async deleteApplication(recipeId: string, modelId: string) {
    // clear any existing status / tasks related to the pair recipeId-modelId.
    this.taskRegistry.deleteByLabels({
      'recipe-id': recipeId,
      'model-id': modelId,
    });

    const stoppingTask = this.taskRegistry.createTask(`Stopping AI App`, 'loading', {
      'recipe-id': recipeId,
      'model-id': modelId,
    });
    try {
      const appPod = await this.getApplicationPod(recipeId, modelId);
      try {
        await containerEngine.stopPod(appPod.engineId, appPod.Id);
      } catch (err: unknown) {
        // continue when the pod is already stopped
        if (!String(err).includes('pod already stopped')) {
          stoppingTask.error = 'error stopping the pod. Please try to stop and remove the pod manually';
          stoppingTask.name = 'Error stopping AI App';
          this.taskRegistry.updateTask(stoppingTask);
          throw err;
        }
      }
      this.protectTasks.add(appPod.Id);
      await containerEngine.removePod(appPod.engineId, appPod.Id);

      stoppingTask.state = 'success';
      stoppingTask.name = `AI App stopped`;
    } catch (err: unknown) {
      stoppingTask.error = 'error removing the pod. Please try to remove the pod manually';
      stoppingTask.name = 'Error stopping AI App';
      throw err;
    } finally {
      this.taskRegistry.updateTask(stoppingTask);
    }
  }

  async restartApplication(recipeId: string, modelId: string) {
    const appPod = await this.getApplicationPod(recipeId, modelId);
    await this.deleteApplication(recipeId, modelId);
    const recipe = this.catalogManager.getRecipeById(recipeId);
    const model = this.catalogManager.getModelById(appPod.Labels[LABEL_MODEL_ID]);
    await this.startApplication(recipe, model);
  }

  async getApplicationPod(recipeId: string, modelId: string): Promise<PodInfo> {
    const appPod = await this.queryPod(recipeId, modelId);
    if (!appPod) {
      throw new Error(`no pod found with recipe Id ${recipeId} and model Id ${modelId}`);
    }
    return appPod;
  }

  async hasApplicationPod(recipeId: string, modelId: string): Promise<boolean> {
    const appPod = await this.queryPod(recipeId, modelId);
    return !!appPod;
  }

  async queryPod(recipeId: string, modelId: string): Promise<PodInfo | undefined> {
    if (!containerEngine.listPods || !containerEngine.stopPod || !containerEngine.removePod) {
      // TODO(feloy) this check can be safely removed when podman desktop 1.8 is released
      // and the extension minimal version is set to 1.8
      return;
    }
    const pods = await containerEngine.listPods();
    return pods.find(
      pod =>
        LABEL_RECIPE_ID in pod.Labels &&
        pod.Labels[LABEL_RECIPE_ID] === recipeId &&
        LABEL_MODEL_ID in pod.Labels &&
        pod.Labels[LABEL_MODEL_ID] === modelId,
    );
  }

  getPortsFromLabel(labels: { [key: string]: string }, key: string): number[] {
    if (!(key in labels)) {
      return [];
    }
    const value = labels[key];
    const portsStr = value.split(',');
    const result: number[] = [];
    for (const portStr of portsStr) {
      const port = parseInt(portStr, 10);
      if (isNaN(port)) {
        // malformed label, just ignore it
        return [];
      }
      result.push(port);
    }
    return result;
  }
}
