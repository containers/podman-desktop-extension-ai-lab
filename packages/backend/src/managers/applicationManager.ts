import { Recipe } from '@shared/models/IRecipe';
import { arch } from 'node:os';
import * as jsYaml from 'js-yaml';
import { GitManager } from './gitManager';
import os from 'os';
import path from 'path';
import fs from 'fs';
import { containerEngine, provider } from '@podman-desktop/api';
import { RecipeStatusRegistry } from '../registries/RecipeStatusRegistry';
import { parseYaml } from '../models/AIConfig';

export const AI_STUDIO_FOLDER = path.join('podman-desktop', 'ai-studio');
export const CONFIG_FILENAME = "ai-studio.yaml";
export class ApplicationManager {

  private homeDirectory: string; // todo: make configurable

  constructor(private git: GitManager, private recipeStatusRegistry: RecipeStatusRegistry,) {
    this.homeDirectory = os.homedir();
  }

  async pullApplication(recipe: Recipe) {
    this.recipeStatusRegistry.setStatus(
      recipe.id,
      [{state: 'loading', name: 'Checkout repository'}]
    );

    const localFolder = path.join(this.homeDirectory, AI_STUDIO_FOLDER, recipe.id);
    // Create folder
    fs.mkdirSync(localFolder);

    // Clone the repository
    await this.git.cloneRepository(recipe.repository, localFolder);

    this.recipeStatusRegistry.setStatus(
      recipe.id,
      [{state: 'success', name: 'Checkout repository'}]
    );

    let configFile: string;
    if(recipe.config !== undefined) {
      configFile = path.join(localFolder, recipe.config);
    } else {
      configFile = path.join(localFolder, CONFIG_FILENAME);
    }

    if(!fs.existsSync(configFile)) {
      // todo: inform user
      this.recipeStatusRegistry.setStatus(
        recipe.id,
        [
          {state: 'success', name: 'Checkout repository'},
          {state: 'error', name: 'Reading configuration'}
        ]
      );
      throw new Error(`The file located at ${configFile} does not exist.`);
    }

    // Parsing the configuration
    const rawConfiguration = fs.readFileSync(configFile, 'utf-8');
    const aiConfig = parseYaml(rawConfiguration, arch());

    // Getting the provider to use for building
    const connections = provider.getContainerConnections();
    const connection = connections[0];

    // Promise all the build images
    return Promise.all(
      aiConfig.application.containers.map((container) => {
        containerEngine.buildImage(
          path.join(localFolder, container.contextdir),
          container.containerfile,
          `${container.name}:latest`,
          connection.connection,
          (event, data) => {
            // todo: do something with the event
          }
        ).then(() => {
          // todo: update status
        }).catch(err => {
          //todo: update status
        })
      })
    )
  }
}
