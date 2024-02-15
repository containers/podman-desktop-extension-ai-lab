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
import type { RecipeStatusRegistry } from '../registries/RecipeStatusRegistry';
import type { AIConfig, AIConfigFile, ContainerConfig } from '../models/AIConfig';
import { parseYamlFile } from '../models/AIConfig';
import type { Task } from '@shared/src/models/ITask';
import { RecipeStatusUtils } from '../utils/recipeStatusUtils';
import { getParentDirectory } from '../utils/pathUtils';
import type { ModelInfo } from '@shared/src/models/IModelInfo';
import type { ModelsManager } from './modelsManager';
import { getPortsInfo } from '../utils/ports';
import { goarch } from '../utils/arch';
import { getDurationSecondsSince, isEndpointAlive, timeout } from '../utils/utils';
import { LABEL_MODEL_ID } from './playground';
import type { EnvironmentState } from '@shared/src/models/IEnvironmentState';
import type { PodmanConnection } from './podmanConnection';
import { MSG_ENVIRONMENTS_STATE_UPDATE } from '@shared/Messages';
import type { CatalogManager } from './catalogManager';

export const LABEL_RECIPE_ID = 'ai-studio-recipe-id';

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

export class ApplicationManager {
  // Map recipeId => EnvironmentState
  #environments: Map<string, EnvironmentState>;

  constructor(
    private appUserDirectory: string,
    private git: GitManager,
    private recipeStatusRegistry: RecipeStatusRegistry,
    private webview: Webview,
    private podmanConnection: PodmanConnection,
    private catalogManager: CatalogManager,
    private modelsManager: ModelsManager,
    private telemetry: TelemetryLogger,
  ) {
    this.#environments = new Map();
  }

  async pullApplication(recipe: Recipe, model: ModelInfo, taskUtil?: RecipeStatusUtils) {
    const startTime = performance.now();
    try {
      // Create a TaskUtils object to help us
      if (!taskUtil) {
        taskUtil = new RecipeStatusUtils(recipe.id, this.recipeStatusRegistry);
      }

      const localFolder = path.join(this.appUserDirectory, recipe.id);

      // clone the recipe repository on the local folder
      const gitCloneInfo: GitCloneInfo = {
        repository: recipe.repository,
        ref: recipe.ref,
        targetDirectory: localFolder,
      };
      await this.doCheckout(gitCloneInfo, taskUtil);

      // load and parse the recipe configuration file and filter containers based on architecture, gpu accelerator
      // and backend (that define which model supports)
      const configAndFilteredContainers = this.getConfigAndFilterContainers(recipe.config, localFolder, taskUtil);

      // Create the task on the recipe (which will be propagated to the TaskRegistry
      taskUtil.setTask({
        id: model.id,
        state: 'loading',
        name: `Downloading model ${model.name}`,
        labels: {
          'model-pulling': model.id,
        },
      });
      // get model by downloading it or retrieving locally
      const modelPath = await this.modelsManager.downloadModel(model);

      // build all images, one per container (for a basic sample we should have 2 containers = sample app + model service)
      const images = await this.buildImages(
        configAndFilteredContainers.containers,
        configAndFilteredContainers.aiConfigFile.path,
        taskUtil,
      );

      // create a pod containing all the containers to run the application
      const podInfo = await this.createApplicationPod(recipe, model, images, modelPath, taskUtil);

      await this.runApplication(podInfo, taskUtil);
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

  async runApplication(podInfo: ApplicationPodInfo, taskUtil: RecipeStatusUtils) {
    taskUtil.setTask({
      id: `running-${podInfo.Id}`,
      state: 'loading',
      name: `Starting application`,
    });

    // it starts the pod
    await containerEngine.startPod(podInfo.engineId, podInfo.Id);

    // most probably the sample app will fail at starting as it tries to connect to the model_service which is still loading the model
    // so we check if the endpoint is ready before to restart the sample app
    // check if sample app container actually started
    const sampleApp = podInfo.containers?.find(container => !container.modelService);
    if (sampleApp) {
      const modelServiceContainer = podInfo.containers?.find(container => container.modelService);
      if (modelServiceContainer) {
        const modelServicePortMapping = podInfo.portmappings.find(
          port => port.container_port === Number(modelServiceContainer.ports[0]),
        );
        if (modelServicePortMapping) {
          await this.restartContainerWhenModelServiceIsUp(
            podInfo.engineId,
            `http://localhost:${modelServicePortMapping.host_port}`,
            sampleApp,
          ).catch((e: unknown) => {
            console.error(String(e));
          });
        }
      }
    }

    taskUtil.setTask({
      id: `running-${podInfo.Id}`,
      state: 'success',
      name: `Application is running`,
    });
  }

  async restartContainerWhenModelServiceIsUp(
    engineId: string,
    modelServiceEndpoint: string,
    container: ContainerAttachedInfo,
  ): Promise<void> {
    const alive = await isEndpointAlive(modelServiceEndpoint);
    if (alive) {
      const sampleAppContainerInspectInfo = await containerEngine.inspectContainer(engineId, container.name);
      if (!sampleAppContainerInspectInfo.State.Running) {
        await containerEngine.startContainer(engineId, container.name);
      }
      return;
    }
    await timeout(5000);
    await this.restartContainerWhenModelServiceIsUp(engineId, modelServiceEndpoint, container).catch(
      (error: unknown) => {
        console.error('Error monitoring endpoint', error);
      },
    );
  }

  async createApplicationPod(
    recipe: Recipe,
    model: ModelInfo,
    images: ImageInfo[],
    modelPath: string,
    taskUtil: RecipeStatusUtils,
  ): Promise<ApplicationPodInfo> {
    // create empty pod
    let podInfo: ApplicationPodInfo;
    try {
      podInfo = await this.createPod(recipe, model, images);
    } catch (e) {
      console.error('error when creating pod', e);
      taskUtil.setTask({
        id: 'fake-pod-id',
        state: 'error',
        error: `Something went wrong while creating pod: ${String(e)}`,
        name: 'Creating application',
      });
      throw e;
    }

    taskUtil.setTask({
      id: podInfo.Id,
      state: 'loading',
      name: `Creating application`,
    });

    let attachedContainers: ContainerAttachedInfo[];
    try {
      attachedContainers = await this.createAndAddContainersToPod(podInfo, images, modelPath);
    } catch (e) {
      console.error(`error when creating pod ${podInfo.Id}`, e);
      taskUtil.setTask({
        id: podInfo.Id,
        state: 'error',
        error: `Something went wrong while creating pod: ${String(e)}`,
        name: 'Creating application',
      });
      throw e;
    }

    taskUtil.setTask({
      id: podInfo.Id,
      state: 'success',
      name: `Creating application`,
    });

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
    const pod = await containerEngine.createPod({
      name: this.getRandomName(`pod-${sampleAppImageInfo.appName}`),
      portmappings: portmappings,
      labels: {
        [LABEL_RECIPE_ID]: recipe.id,
        [LABEL_MODEL_ID]: model.id,
      },
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
    containers: ContainerConfig[],
    configPath: string,
    taskUtil: RecipeStatusUtils,
  ): Promise<ImageInfo[]> {
    containers.forEach(container => {
      taskUtil.setTask({
        id: container.name,
        state: 'loading',
        name: `Building ${container.name}`,
      });
    });

    const imageInfoList: ImageInfo[] = [];

    // Promise all the build images
    await Promise.all(
      containers.map(container => {
        // We use the parent directory of our configFile as the rootdir, then we append the contextDir provided
        const context = path.join(getParentDirectory(configPath), container.contextdir);
        console.log(`Application Manager using context ${context} for container ${container.name}`);

        // Ensure the context provided exist otherwise throw an Error
        if (!fs.existsSync(context)) {
          taskUtil.setTaskError(container.name, 'The context provided does not exist.');
          throw new Error('Context configured does not exist.');
        }

        const buildOptions = {
          containerFile: container.containerfile,
          tag: `${container.name}:latest`,
          labels: {
            [LABEL_RECIPE_ID]: taskUtil.toRecipeStatus().recipeId,
          },
        };

        return containerEngine
          .buildImage(
            context,
            (event, data) => {
              // todo: do something with the event
              if (event === 'error' || (event === 'finish' && data !== '')) {
                console.error('Something went wrong while building the image: ', data);
                taskUtil.setTaskError(container.name, `Something went wrong while building the image: ${data}`);
              }
            },
            buildOptions,
          )
          .catch((err: unknown) => {
            taskUtil.setTaskError(container.name, `Something went wrong while building the image: ${String(err)}`);
            throw new Error(`Something went wrong while building the image: ${String(err)}`);
          });
      }),
    );

    // after image are built we return their data
    const images = await containerEngine.listImages();
    await Promise.all(
      containers.map(async container => {
        const image = images.find(im => {
          return im.RepoTags?.some(tag => tag.endsWith(`${container.name}:latest`));
        });

        if (!image) {
          taskUtil.setTaskError(container.name, 'no image found');
          throw new Error(`no image found for ${container.name}:latest`);
        }

        const imageInspectInfo = await containerEngine.getImageInspect(image.engineId, image.Id);
        const exposedPorts = Array.from(Object.keys(imageInspectInfo?.Config?.ExposedPorts || {})).map(port => {
          if (port.endsWith('/tcp') || port.endsWith('/udp')) {
            return port.substring(0, port.length - 4);
          }
          return port;
        });

        imageInfoList.push({
          id: image.Id,
          modelService: container.modelService,
          ports: exposedPorts,
          appName: container.name,
        });

        taskUtil.setTaskState(container.name, 'success');
      }),
    );

    return imageInfoList;
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
    } catch (e) {
      loadingConfiguration.state = 'error';
      taskUtil.setTaskError('loading-config', `Something went wrong while loading configuration: ${String(e)}.`);
      throw e;
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

  async doCheckout(gitCloneInfo: GitCloneInfo, taskUtil: RecipeStatusUtils) {
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
    if (fs.existsSync(gitCloneInfo.targetDirectory) && fs.statSync(gitCloneInfo.targetDirectory).isDirectory()) {
      // Update checkout state
      checkoutTask.name = 'Checkout repository (cached).';
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
    // Update task
    taskUtil.setTask(checkoutTask);
  }

  adoptRunningEnvironments() {
    this.podmanConnection.startupSubscribe(() => {
      if (!containerEngine.listPods) {
        // TODO(feloy) this check can be safely removed when podman desktop 1.8 is released
        // and the extension minimal version is set to 1.8
        return;
      }
      containerEngine
        .listPods()
        .then(pods => {
          const envsPods = pods.filter(pod => LABEL_RECIPE_ID in pod.Labels);
          for (const podToAdopt of envsPods) {
            this.adoptPod(podToAdopt);
          }
        })
        .catch((err: unknown) => {
          console.error('error during adoption of existing playground containers', err);
        });
    });

    this.podmanConnection.onMachineStop(() => {
      // Podman Machine has been stopped, we consider all recipe pods are stopped
      this.#environments.clear();
      this.sendEnvironmentState();
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
    if (this.#environments.has(recipeId)) {
      return;
    }
    const state: EnvironmentState = {
      recipeId,
      modelId,
      pod,
    };
    this.updateEnvironmentState(recipeId, state);
  }

  forgetPod(pod: PodInfo) {
    if (!pod.Labels) {
      return;
    }
    const recipeId = pod.Labels[LABEL_RECIPE_ID];
    if (!this.#environments.has(recipeId)) {
      return;
    }
    this.#environments.delete(recipeId);
    this.sendEnvironmentState();
  }

  forgetPodById(podId: string) {
    const env = Array.from(this.#environments.values()).find(p => p.pod.Id === podId);
    if (!env) {
      return;
    }
    if (!env.pod.Labels) {
      return;
    }
    const recipeId = env.pod.Labels[LABEL_RECIPE_ID];
    if (!this.#environments.has(recipeId)) {
      return;
    }
    this.#environments.delete(recipeId);
    this.sendEnvironmentState();
  }

  updateEnvironmentState(recipeId: string, state: EnvironmentState): void {
    this.#environments.set(recipeId, state);
    this.sendEnvironmentState();
  }

  getEnvironmentsState(): EnvironmentState[] {
    return Array.from(this.#environments.values());
  }

  sendEnvironmentState() {
    this.webview
      .postMessage({
        id: MSG_ENVIRONMENTS_STATE_UPDATE,
        body: this.getEnvironmentsState(),
      })
      .catch((err: unknown) => {
        console.error(`Something went wrong while emitting MSG_ENVIRONMENTS_STATE_UPDATE: ${String(err)}`);
      });
  }

  async deleteEnvironment(recipeId: string, taskUtil?: RecipeStatusUtils) {
    if (!taskUtil) {
      taskUtil = new RecipeStatusUtils(recipeId, this.recipeStatusRegistry);
    }
    try {
      taskUtil.setTask({
        id: `stopping-${recipeId}`,
        state: 'loading',
        name: `Stopping application`,
      });
      const envPod = await this.getEnvironmentPod(recipeId);
      try {
        await containerEngine.stopPod(envPod.engineId, envPod.Id);
        taskUtil.setTask({
          id: `stopping-${recipeId}`,
          state: 'success',
          name: `Application stopped`,
        });
      } catch (err: unknown) {
        // continue when the pod is already stopped
        if (!String(err).includes('pod already stopped')) {
          taskUtil.setTask({
            id: `stopping-${recipeId}`,
            state: 'error',
            error: 'error stopping the pod. Please try to remove the pod manually',
            name: `Error stopping application`,
          });
          throw err;
        }
        taskUtil.setTask({
          id: `stopping-${recipeId}`,
          state: 'success',
          name: `Application stopped`,
        });
      }
      taskUtil.setTask({
        id: `removing-${recipeId}`,
        state: 'loading',
        name: `Removing application`,
      });
      await containerEngine.removePod(envPod.engineId, envPod.Id);
      taskUtil.setTask({
        id: `removing-${recipeId}`,
        state: 'success',
        name: `Application removed`,
      });
    } catch (err: unknown) {
      taskUtil.setTask({
        id: `removing-${recipeId}`,
        state: 'error',
        error: 'error removing the pod. Please try to remove the pod manually',
        name: `Error removing application`,
      });
      throw err;
    }
  }

  async restartEnvironment(recipeId: string) {
    const taskUtil = new RecipeStatusUtils(recipeId, this.recipeStatusRegistry);
    const envPod = await this.getEnvironmentPod(recipeId);
    await this.deleteEnvironment(recipeId, taskUtil);
    const recipe = this.catalogManager.getRecipeById(recipeId);
    const model = this.catalogManager.getModelById(envPod.Labels[LABEL_MODEL_ID]);
    await this.pullApplication(recipe, model, taskUtil);
  }

  async getEnvironmentPod(recipeId: string): Promise<PodInfo> {
    if (!containerEngine.listPods || !containerEngine.stopPod || !containerEngine.removePod) {
      // TODO(feloy) this check can be safely removed when podman desktop 1.8 is released
      // and the extension minimal version is set to 1.8
      return;
    }
    const pods = await containerEngine.listPods();
    const envPod = pods.find(pod => LABEL_RECIPE_ID in pod.Labels && pod.Labels[LABEL_RECIPE_ID] === recipeId);
    if (!envPod) {
      throw new Error(`no pod found with recipe Id ${recipeId}`);
    }
    return envPod;
  }
}
