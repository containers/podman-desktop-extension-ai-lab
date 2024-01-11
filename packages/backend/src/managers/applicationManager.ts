import { Recipe } from '@shared/models/IRecipe';
import { arch } from 'node:os';
import * as jsYaml from 'js-yaml';
import { GitManager } from './gitManager';
import os from 'os';
import path from 'path';
import fs from 'fs';
import { containerEngine, provider } from '@podman-desktop/api';
import { RecipeStatusRegistry } from '../registries/RecipeStatusRegistry';

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

    const configuration = fs.readFileSync(configFile, 'utf-8');

    try {

      // parse the content using jsYaml
      const defaultArch = arch();
      const aiStudioConfig = jsYaml.load(configuration);
      const application = aiStudioConfig?.["application"];
      if (application) {
        const containers = application["containers"] ?? [];
        // Todo: build in parallels
        for (const container of containers) {
          const arch = container["arch"] ?? defaultArch;
          if (arch === defaultArch) {
            const isModelService = container["model-service"] ?? false;
            if (isModelService) {
              // download the model ?? or find it ??
              return;
            }
            const contextDir  = container["contextdir"];
            const nameImage = container["name"];
            if (contextDir) {
              const connections = provider.getContainerConnections();
              const connection = connections[0];
              await containerEngine.buildImage(
                'C:\\Users\\baldr\\Work\\github.com\\containers\\hackaton\\locallm\\chatbot\\ai_applications',
                'builds\\Containerfile',
                `quay.io/lstocchi/${nameImage}:latest`,
                connection.connection,
                (event, data) => {
                  // todo: do something with the event
                }
              )
            }
          }
        }
      }
    } catch (e) {
      console.error("Something went wrong", e);
      this.recipeStatusRegistry.setStatus(
        recipe.id,
        [
          {state: 'success', name: 'Checkout repository'},
          {state: 'error', name: 'Building image(s)'}
        ]
      );
    }

  }

}
