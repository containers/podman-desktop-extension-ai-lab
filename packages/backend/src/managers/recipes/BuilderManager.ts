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
import { type BuildImageOptions, type Disposable, containerEngine } from '@podman-desktop/api';
import type { TaskRegistry } from '../../registries/TaskRegistry';
import type { Recipe } from '@shared/src/models/IRecipe';
import type { ContainerConfig } from '../../models/AIConfig';
import type { ImageInfo} from '../applicationManager';
import { LABEL_RECIPE_ID } from '../applicationManager';
import type { Task } from '@shared/src/models/ITask';
import path from 'node:path';
import { getParentDirectory } from '../../utils/pathUtils';
import fs from 'fs';
import { getImageTag } from '../../utils/imagesUtils';

export class BuilderManager implements Disposable {
  private controller: Map<string, AbortController> = new Map();

  constructor(private taskRegistry: TaskRegistry) {}

  /**
   * On dispose, the builder will abort all current build.
   */
  dispose(): void {
    Array.from(this.controller.values()).every(controller => controller.abort('disposing builder manager'));
  }

  async build(
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
    const abortController = new AbortController();

    // only one build per recipe is supported
    if (this.controller.has(recipe.id)) {
      this.controller.get(recipe.id)?.abort('multiple build not supported.');
    }

    this.controller.set(recipe.id, abortController);

    try {
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

          const imageTag = getImageTag(recipe, container);
          const buildOptions: BuildImageOptions = {
            containerFile: container.containerfile,
            tag: imageTag,
            labels: {
              [LABEL_RECIPE_ID]: labels !== undefined && 'recipe-id' in labels ? labels['recipe-id'] : '',
            },
            abortController: abortController,
          };

          let error = false;
          return containerEngine
            .buildImage(
              context,
              (event, data) => {
                // todo: do something with the event
                if (event === 'error' || (event === 'finish' && data !== '')) {
                  console.error('Something went wrong while building the image: ', data);
                  task.error = `Something went wrong while building the image: ${data}`;
                  this.taskRegistry.updateTask(task);
                  error = true;
                }
              },
              buildOptions,
            )
            .catch((err: unknown) => {
              task.error = `Something went wrong while building the image: ${String(err)}`;
              this.taskRegistry.updateTask(task);
              throw new Error(`Something went wrong while building the image: ${String(err)}`);
            })
            .then(() => {
              if (error) {
                throw new Error(`Something went wrong while building the image: ${imageTag}`);
              }
            });
        }),
      );
    } catch (err: unknown) {
      abortController.abort();
      throw err;
    } finally {
      // remove abort controller
      this.controller.delete(recipe.id);
    }

    // after image are built we return their data
    const images = await containerEngine.listImages();
    await Promise.all(
      containers.map(async container => {
        const task = containerTasks[container.name];
        const imageTag = getImageTag(recipe, container);

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
}
