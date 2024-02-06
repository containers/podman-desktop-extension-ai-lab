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
import { LABEL_RECIPE_ID } from './applicationManager';
import { MSG_ENVIRONMENTS_STATE_UPDATE } from '@shared/Messages';
import type { EnvironmentState } from '@shared/src/models/IEnvironmentState';

export class EnvironmentManager {
  #environments: Map<string, EnvironmentState>;

  constructor(
    private webview: Webview,
    private podmanConnection: PodmanConnection,
  ) {
    this.#environments = new Map();
  }

  adoptRunningEnvironments() {
    this.podmanConnection.startupSubscribe(() => {
      containerEngine
        .listPods()
        .then(pods => {
          console.log('pods', pods);
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
    console.log('adopt pod');
    const recipeId = pod.Labels[LABEL_RECIPE_ID];
    if (this.#environments.has(recipeId)) {
      return;
    }
    console.log('adopt pod', recipeId);
    const state: EnvironmentState = {
      recipeId,
      pod,
    };
    this.updateEnvironmentState(recipeId, state);
  }

  forgetPod(pod: PodInfo) {
    console.log('forget pod');
    const recipeId = pod.Labels[LABEL_RECIPE_ID];
    if (!this.#environments.has(recipeId)) {
      return;
    }
    console.log('forget pod', recipeId);
    this.#environments.delete(recipeId);
    this.sendEnvironmentState();
  }

  forgetPodById(podId: string) {
    console.log('forget pod by id');
    const env = Array.from(this.#environments.values()).find(p => p.pod.Id === podId);
    if (!env) {
      console.log('==> pod with id not found');
      return;
    }
    const recipeId = env.pod.Labels[LABEL_RECIPE_ID];
    if (!this.#environments.has(recipeId)) {
      console.log('==> labels not found on pod');
      return;
    }
    this.#environments.delete(recipeId);
    this.sendEnvironmentState();
    console.log('==> forgot pod');
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
}
