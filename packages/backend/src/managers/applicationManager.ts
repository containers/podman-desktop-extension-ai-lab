import { Recipe } from '@shared/models/IRecipe';
import { arch } from 'node:os';
import { GitManager } from './gitManager';
import os from 'os';
import path from 'path';
import fs from 'fs';
import { containerEngine, provider } from '@podman-desktop/api';
import { RecipeStatusRegistry } from '../registries/RecipeStatusRegistry';
import { parseYaml } from '../models/AIConfig';
import { Task } from '@shared/models/ITask';
import { TaskUtils } from '../utils/taskUtils';

export const AI_STUDIO_FOLDER = path.join('podman-desktop', 'ai-studio');
export const CONFIG_FILENAME = "ai-studio.yaml";
export class ApplicationManager {

  private homeDirectory: string; // todo: make configurable

  constructor(private git: GitManager, private recipeStatusRegistry: RecipeStatusRegistry,) {
    this.homeDirectory = os.homedir();
  }

  async pullApplication(recipe: Recipe) {
    // Create a TaskUtils object to help us
    const taskUtil = new TaskUtils(recipe.id, this.recipeStatusRegistry);
    // Adding checkout task
    const checkoutTask: Task = {
      id: 'checkout',
      name: 'Checkout repository',
      state: 'loading',
    }
    taskUtil.setTask(checkoutTask);

    const localFolder = path.join(this.homeDirectory, AI_STUDIO_FOLDER, recipe.id);
    // Create folder
    fs.mkdirSync(localFolder);

    // Clone the repository
    await this.git.cloneRepository(recipe.repository, localFolder);

    // Update checkout state
    checkoutTask.state = 'success';
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

    // Parsing the configuration
    const rawConfiguration = fs.readFileSync(configFile, 'utf-8');
    const aiConfig = parseYaml(rawConfiguration, arch());

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
        containerEngine.buildImage(
          path.join(localFolder, container.contextdir),
          container.containerfile,
          `${container.name}:latest`,
          connection.connection,
          (event, data) => {
            // todo: do something with the event
          }
        ).then(() => {
          taskUtil.setTaskState(container.name, 'success');
        }).catch(err => {
          console.error(`Something went wrong while building the image ${String(err)}`);
          taskUtil.setTaskState(container.name, 'error');
        })
      )
    )
  }
}
