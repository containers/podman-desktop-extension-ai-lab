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
import type { Disposable, Webview } from '@podman-desktop/api';
import type { ModelsManager } from '../modelsManager';
import { Publisher } from '../../utils/Publisher';
import type { UpdateInfo } from '@shared/src/models/IUpdate';
import { Messages } from '@shared/Messages';
import https from 'node:https';
import fs, { promises } from 'node:fs';
import path from 'node:path';
import type { ModelInfo } from '@shared/src/models/IModelInfo';

export class UpdateManager extends Publisher<UpdateInfo[]> implements Disposable {
  #updates: Map<string, UpdateInfo> = new Map();

  constructor(
    webview: Webview,
    private modelsManager: ModelsManager,
  ) {
    super(webview, Messages.MSG_UPDATES_INFO, () => this.getAll());
  }

  getAll(): UpdateInfo[] {
    return Array.from(this.#updates.values());
  }

  dispose(): void {
    this.#updates.clear();
  }

  private async checkUpdates(): Promise<void> {
    const models = this.modelsManager.getModelsInfo();
    for (const model of models) {
      if (!model.url || !model.file) continue;

      const localEtag = await this.readEtagValue(model.file.path);
      if (!localEtag) continue;

      let remoteEtag: string | undefined = undefined;
      try {
        remoteEtag = await this.getEtag(model.url);
      } catch (err: unknown) {
        console.error(`Something went wrong while getting the etag for model ${model.id}:`, err);
      }

      if (!remoteEtag) continue;

      if (localEtag !== remoteEtag) {
        this.#updates.set(model.id, {
          modelId: model.id,
          message: 'New update is available.',
        });
      }
    }
  }

  init(): void {
    this.checkUpdates().catch((err: unknown) => {
      console.error('Something went wrong while checking models updates', err);
    });
  }

  async requestUpdate(modelId: string): Promise<void> {
    console.log(`requestUpdate ${modelId}`);

    const modelInfo: ModelInfo = this.modelsManager.getModelInfo(modelId);
    if (!modelInfo.url || !modelInfo.file) throw new Error(`model with id ${modelId} cannot be updated.`);

    if (!this.#updates.has(modelId)) throw new Error(`no update available for the model id ${modelId}`);

    const etag = await this.getEtag(modelInfo.url);
    if (!etag) {
      // cleanup
      this.#updates.delete(modelId);
      throw new Error('Something went wrong: undefined etag.');
    }

    console.log(`requestDownloadModel ${modelId}`);
    await this.modelsManager.requestDownloadModel(modelInfo, {
      'is-update': 'true',
    });

    // update the etag file
    await this.writeEtagValue(modelInfo.file.path, etag);

    this.#updates.delete(modelId);
  }

  private getEtagPath(directory: string): string {
    return path.join(directory, 'etag');
  }

  /**
   * read the etag value from the `etag` utf-8 file
   */
  private async readEtagValue(directory: string): Promise<string | undefined> {
    const etagPath = this.getEtagPath(directory);

    if (!fs.existsSync(etagPath)) return undefined;

    const content = await promises.readFile(etagPath, 'utf-8');
    return content.trim();
  }

  /**
   * write the etag value to the `etag` utf-8 file
   */
  private async writeEtagValue(directory: string, value: string): Promise<void> {
    const etagPath = this.getEtagPath(directory);

    return promises.writeFile(etagPath, value, 'utf-8');
  }

  /**
   * wrapper of the fetchETag to transform as a promise the result instead of a callback
   * @param url
   */
  private getEtag(url: string): Promise<string | undefined> {
    return new Promise((resolve, reject) => {
      // fetch through a HEAD request the Etag property
      this.fetchETag(url, result => {
        if (result.error) {
          reject(new Error(result.error));
          return;
        }

        resolve(result.etag);
      });
    });
  }

  /**
   * given an url, perform a head request to it, and will perform a callback with
   * the result of the call
   * @param url the url to perform the head request on
   * @param callback the function to callback
   */
  private fetchETag(url: string, callback: (result: { etag?: string; error?: string }) => void): void {
    https.get(
      url,
      {
        method: 'HEAD',
      },
      resp => {
        // follow redirect
        if (resp.headers.location) {
          this.fetchETag(resp.headers.location, callback);
          return;
        }

        if (!('etag' in resp.headers) || typeof resp.headers['etag'] !== 'string') {
          callback({ error: `ETag could not be found for ${url}` });
        } else {
          callback({ etag: resp.headers['etag'] });
        }
      },
    );
  }
}
