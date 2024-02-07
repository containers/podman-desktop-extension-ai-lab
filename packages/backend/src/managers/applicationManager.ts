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
import { type PodCreatePortOptions, containerEngine, type TelemetryLogger } from '@podman-desktop/api';
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

export interface PodInfo {
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
  constructor(
    private appUserDirectory: string,
    private git: GitManager,
    private recipeStatusRegistry: RecipeStatusRegistry,
    private modelsManager: ModelsManager,
    private telemetry: TelemetryLogger,
  ) {}

  async pullApplication(recipe: Recipe, model: ModelInfo) {
    const startTime = performance.now();
    try {
      // Create a TaskUtils object to help us
      const taskUtil = new RecipeStatusUtils(recipe.id, this.recipeStatusRegistry);

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

      // get model by downloading it or retrieving locally
      const modelPath = await this.modelsManager.downloadModel(model, taskUtil);

      // build all images, one per container (for a basic sample we should have 2 containers = sample app + model service)
      const images = await this.buildImages(
        configAndFilteredContainers.containers,
        configAndFilteredContainers.aiConfigFile.path,
        taskUtil,
      );

      // create a pod containing all the containers to run the application
      const podInfo = await this.createApplicationPod(images, modelPath, taskUtil);

      await this.runApplication(podInfo, taskUtil);
      taskUtil.setStatus('running');
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

  async runApplication(podInfo: PodInfo, taskUtil: RecipeStatusUtils) {
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

  async createApplicationPod(images: ImageInfo[], modelPath: string, taskUtil: RecipeStatusUtils): Promise<PodInfo> {
    // create empty pod
    let podInfo: PodInfo;
    try {
      podInfo = await this.createPod(images);
    } catch (e) {
      console.error('error when creating pod');
      taskUtil.setTask({
        id: 'fake-pod-id',
        state: 'error',
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
      console.error(`error when creating pod ${podInfo.Id}`);
      taskUtil.setTask({
        id: podInfo.Id,
        state: 'error',
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
    podInfo: PodInfo,
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

  async createPod(images: ImageInfo[]): Promise<PodInfo> {
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
          console.error('The context provided does not exist.');
          taskUtil.setTaskState(container.name, 'error');
          throw new Error('Context configured does not exist.');
        }

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
              }
            },
            buildOptions,
          )
          .catch((err: unknown) => {
            console.error('Something went wrong while building the image: ', err);
            taskUtil.setTaskState(container.name, 'error');
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
          console.error('no image found');
          taskUtil.setTaskState(container.name, 'error');
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
      taskUtil.setTask(loadingConfiguration);
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
}
