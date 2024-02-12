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

import { type PodInfo, type Webview, containerEngine } from '@podman-desktop/api';
import type { PodmanConnection } from './podmanConnection';
import { ApplicationManager, LABEL_RECIPE_ID } from './applicationManager';
import { MSG_ENVIRONMENTS_STATE_UPDATE } from '@shared/Messages';
import type { EnvironmentState, EnvironmentStatus } from '@shared/src/models/IEnvironmentState';
import { CatalogManager } from './catalogManager';
import { LABEL_MODEL_ID } from './playground';

/**
 *  An Environment is represented as a Pod, independently on how it has been created (by applicationManager or any other manager)
 *  A requisite is that the Pod defines a label LABEL_RECIPE_ID
 */
export class EnvironmentManager {
  #environments: Map<string, EnvironmentState>;

  constructor(
    private webview: Webview,
    private podmanConnection: PodmanConnection,
    private applicationManager: ApplicationManager,
    private catalogManager: CatalogManager,
  ) {
    this.#environments = new Map();
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
            this.adoptPod(podToAdopt, 'running');
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
      this.adoptPod(pod, 'running');
    });
    this.podmanConnection.onPodStop((pod: PodInfo) => {
      this.forgetPod(pod);
    });
    this.podmanConnection.onPodRemove((podId: string) => {
      this.forgetPodById(podId);
    });
  }

  adoptPod(pod: PodInfo, status: EnvironmentStatus) {
    if (!pod.Labels) {
      return;
    }
    const recipeId = pod.Labels[LABEL_RECIPE_ID];
    if (this.#environments.has(recipeId)) {
      return;
    }
    const state: EnvironmentState = {
      recipeId,
      pod,
      status,
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

  async deleteEnvironment(recipeId: string) {
    try {
      this.setEnvironmentStatus(recipeId, 'stopping');
      const envPod = await this.getEnvironmentPod(recipeId);
      try {
        await containerEngine.stopPod(envPod.engineId, envPod.Id);
      } catch (err: unknown) {
        // continue when the pod is already stopped
        if (!String(err).includes('pod already stopped')) {
          throw err;
        }
      }
      this.setEnvironmentStatus(recipeId, 'removing');
      await containerEngine.removePod(envPod.engineId, envPod.Id);
    } catch (err: unknown) {
      this.setEnvironmentStatus(recipeId, 'unknown');
      throw err;
    }
  }

  async restartEnvironment(recipeId: string) {
    const envPod = await this.getEnvironmentPod(recipeId);
    await this.deleteEnvironment(recipeId);
    try {
      const recipe = this.catalogManager.getRecipeById(recipeId);
      const model = this.catalogManager.getModelById(envPod.Labels[LABEL_MODEL_ID]);
      await this.applicationManager.pullApplication(recipe, model);
    } catch (err: unknown) {
      this.setEnvironmentStatus(recipeId, 'unknown');
      throw err;
    }
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

  setEnvironmentStatus(recipeId: string, status: EnvironmentStatus): void {
    if (!this.#environments.has(recipeId)) {
      throw new Error(`status for environemnt ${recipeId} not found`);
    }
    const previous = this.#environments.get(recipeId);
    this.updateEnvironmentState(recipeId, {
      ...previous,
      status: status,
    });
  }
}
