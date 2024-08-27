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
import type { Disposable, PodCreateOptions, PodInfo, Event } from '@podman-desktop/api';
import { containerEngine, EventEmitter } from '@podman-desktop/api';
import type { PodHealth } from '@shared/src/models/IApplicationState';
import { getPodHealth } from '../../utils/podsUtils';

export interface PodEvent {
  podId: string;
}

export class PodManager implements Disposable {
  #eventDisposable: Disposable | undefined;

  // start pod events
  private readonly _onStartPodEvent = new EventEmitter<PodInfo>();
  readonly onStartPodEvent: Event<PodInfo> = this._onStartPodEvent.event;

  // stop pod events
  private readonly _onStopPodEvent = new EventEmitter<PodInfo>();
  readonly onStopPodEvent: Event<PodInfo> = this._onStopPodEvent.event;

  // remove pod events
  private readonly _onRemovePodEvent = new EventEmitter<PodEvent>();
  readonly onRemovePodEvent: Event<PodEvent> = this._onRemovePodEvent.event;

  dispose(): void {
    this.#eventDisposable?.dispose();
  }

  init(): void {
    this.#eventDisposable = containerEngine.onEvent(async event => {
      // filter on pod event type
      if (event.Type !== 'pod') {
        return;
      }

      if (event.status === 'remove') {
        return this._onRemovePodEvent.fire({
          podId: event.id,
        });
      }

      const pod: PodInfo = await this.getPodById(event.id);
      switch (event.status) {
        case 'start':
          this._onStartPodEvent.fire(pod);
          break;
        case 'stop':
          this._onStopPodEvent.fire(pod);
          break;
      }
    });
  }

  /**
   * Utility method to get all the pods
   */
  getAllPods(): Promise<PodInfo[]> {
    return containerEngine.listPods();
  }

  /**
   * return the first pod matching the provided labels and their associated value
   * @param requestedLabels the labels the pod must be matching
   */
  async findPodByLabelsValues(requestedLabels: Record<string, string>): Promise<PodInfo | undefined> {
    const pods = await this.getAllPods();

    return pods.find(pod => {
      const labels = pod.Labels;
      // eslint-disable-next-line sonarjs/different-types-comparison
      if (labels === undefined) return false;

      for (const [key, value] of Object.entries(requestedLabels)) {
        if (!(key in labels) || labels[key] !== value) return false;
      }

      return true;
    });
  }

  /**
   * return pods containing all the labels provided
   * This method does not check for the values, only existence
   * @param labels
   */
  async getPodsWithLabels(labels: string[]): Promise<PodInfo[]> {
    const pods = await this.getAllPods();

    return pods.filter(pod => labels.every(label => !!pod.Labels && label in pod.Labels));
  }

  /**
   * Given a pod Info, will fetch the health status of each containing composing it, and
   * will return a PodHealth
   * @param pod the pod to inspect
   */
  async getHealth(pod: PodInfo): Promise<PodHealth> {
    const containerStates: (string | undefined)[] = await Promise.all(
      pod.Containers.map(container =>
        containerEngine.inspectContainer(pod.engineId, container.Id).then(data => data.State.Health?.Status),
      ),
    );

    return getPodHealth(containerStates);
  }

  /**
   * This handy method is private as we do not want expose method not providing
   * the engineId, but this is required because PodEvent do not provide the engineId
   * @param id
   * @private
   */
  private async getPodById(id: string): Promise<PodInfo> {
    const pods = await this.getAllPods();
    const result = pods.find(pod => pod.Id === id);
    if (!result) throw new Error(`pod with Id ${id} cannot be found.`);
    return result;
  }

  async getPod(engineId: string, Id: string): Promise<PodInfo> {
    const pods = await this.getAllPods();
    const result = pods.find(pod => pod.engineId === engineId && pod.Id === Id);
    if (!result) throw new Error(`pod with engineId ${engineId} and Id ${Id} cannot be found.`);
    return result;
  }

  async stopPod(engineId: string, id: string): Promise<void> {
    return containerEngine.stopPod(engineId, id);
  }

  async removePod(engineId: string, id: string): Promise<void> {
    return containerEngine.removePod(engineId, id);
  }

  async startPod(engineId: string, id: string): Promise<void> {
    return containerEngine.startPod(engineId, id);
  }

  async createPod(podOptions: PodCreateOptions): Promise<{ engineId: string; Id: string }> {
    return containerEngine.createPod(podOptions);
  }
}
