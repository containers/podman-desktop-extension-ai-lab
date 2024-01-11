import { Recipe } from '@shared/models/IRecipe';
import { arch } from 'node:os';
import { GitManager } from './gitManager';
import os from 'os';
import path from 'path';
import fs from 'fs';
import { containerEngine, provider } from '@podman-desktop/api';
import { RecipeStatusRegistry } from '../registries/RecipeStatusRegistry';
import { AIConfig, parseYaml } from '../models/AIConfig';
import { Task } from '@shared/models/ITask';
import { TaskUtils } from '../utils/taskUtils';
import { getParentDirectory } from '../utils/pathUtils';

// TODO: Need to be configured
export const AI_STUDIO_FOLDER = path.join('podman-desktop', 'ai-studio');
export const CONFIG_FILENAME = "ai-studio.yaml";
export class ApplicationManager {
  private readonly homeDirectory: string; // todo: make configurable

  constructor(private git: GitManager, private recipeStatusRegistry: RecipeStatusRegistry,) {
    this.homeDirectory = os.homedir();
  }

  async pullApplication(recipe: Recipe) {
    // Create a TaskUtils object to help us
    const taskUtil = new TaskUtils(recipe.id, this.recipeStatusRegistry);

    const localFolder = path.join(this.homeDirectory, AI_STUDIO_FOLDER, recipe.id);

    // Adding checkout task
    const checkoutTask: Task = {
      id: 'checkout',
      name: 'Checkout repository',
      state: 'loading',
    }
    taskUtil.setTask(checkoutTask);

    // We might already have the repository cloned
    if(fs.existsSync(localFolder) && fs.statSync(localFolder).isDirectory()) {
      // Update checkout state
      checkoutTask.name = 'Checkout repository (cached).';
      checkoutTask.state = 'success';
    } else {
      // Create folder
      fs.mkdirSync(localFolder, {recursive: true});

      // Clone the repository
      console.log(`Cloning repository ${recipe.repository} in ${localFolder}.`);
      await this.git.cloneRepository(recipe.repository, localFolder);

      // Update checkout state
      checkoutTask.state = 'success';
    }
    // Update task
    taskUtil.setTask(checkoutTask);

    // Adding loading configuration task
    const loadingConfiguration: Task = {
      id: 'loading-config',
      name: 'Loading configuration',
      state: 'loading',
    }
    taskUtil.setTask(loadingConfiguration);

    let configFile: string;
    if(recipe.config !== undefined) {
      configFile = path.join(localFolder, recipe.config);
    } else {
      configFile = path.join(localFolder, CONFIG_FILENAME);
    }

    if(!fs.existsSync(configFile)) {
      loadingConfiguration.state = 'error';
      taskUtil.setTask(loadingConfiguration);
      throw new Error(`The file located at ${configFile} does not exist.`);
    }

    // If the user configured the config as a directory we check for "ai-studio.yaml" inside.
    if(fs.statSync(configFile).isDirectory()) {
      const tmpPath = path.join(configFile, CONFIG_FILENAME);
      // If it has the ai-studio.yaml we use it.
      if(fs.existsSync(tmpPath)) {
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
      // Mask task as failed
      loadingConfiguration.state = 'error';
      taskUtil.setTask(loadingConfiguration);
      throw new Error('Cannot load configuration file.');
    }

    // Mark as success
    loadingConfiguration.state = 'success';
    taskUtil.setTask(loadingConfiguration);

    // Getting the provider to use for building
    const connections = provider.getContainerConnections();
    const connection = connections[0];

    aiConfig.application.containers.forEach((container) => {
     taskUtil.setTask({
       id: container.name,
       state: 'loading',
       name: `Building ${container.name}`,
     })
    })

    // Promise all the build images
    return Promise.all(
      aiConfig.application.containers.map((container) =>
        {
          // We use the parent directory of our configFile as the rootdir, then we append the contextDir provided
          const context = path.join(getParentDirectory(configFile), container.contextdir);
          console.log(`Application Manager using context ${context} for container ${container.name}`);
          return containerEngine.buildImage(
            context,
            container.containerfile,
            `${container.name}:latest`,
            arch(),
            connection.connection,
            (event, data) => {
              // todo: do something with the event
            }
          ).then(() => {
            taskUtil.setTaskState(container.name, 'success');
          }).catch(err => {
            console.error(`Something went wrong while building the image ${String(err)}`);
            taskUtil.setTaskState(container.name, 'error');
          });
        }
      )
    )
  }
}
