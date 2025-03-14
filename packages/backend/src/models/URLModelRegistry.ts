/**********************************************************************
 * Copyright (C) 2025 Red Hat, Inc.
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
import fs from 'node:fs';
import * as path from 'node:path';
import type { FileSystemWatcher } from '@podman-desktop/api';
import { fs as apiFs } from '@podman-desktop/api';
import { ModelRegistry } from './ModelRegistry';
import type { ModelsManager } from '../managers/modelsManager';
import type { ModelInfo } from '@shared/src/models/IModelInfo';
import type { Downloader } from '../utils/downloader';
import { URLDownloader } from '../utils/urldownloader';

export class URLModelRegistry extends ModelRegistry {
  #watcher: FileSystemWatcher;

  constructor(
    modelsManager: ModelsManager,
    private modelsDir: string,
  ) {
    super('url model registry', modelsManager);
    this.#watcher = apiFs.createFileSystemWatcher(this.modelsDir);
    this.#watcher.onDidCreate(() => this._onUpdate.fire());
    this.#watcher.onDidDelete(() => this._onUpdate.fire());
    this.#watcher.onDidChange(() => this._onUpdate.fire());
  }

  override dispose(): void {
    this.#watcher.dispose();
  }

  override accept(url: string): boolean {
    return url.startsWith('https') || url.startsWith('http') || url.startsWith('file');
  }

  override createDownloader(model: ModelInfo, abortSignal: AbortSignal): Downloader {
    // Ensure path to model directory exist
    const destDir = path.join(this.modelsDir, model.id);
    if (!fs.existsSync(destDir)) {
      fs.mkdirSync(destDir, { recursive: true });
    }

    const target = path.resolve(destDir, path.basename(model.url!));
    return new URLDownloader(model.url!, target, model.sha256, abortSignal);
  }

  override async getLocalModelsFromDisk(): Promise<void> {
    if (!fs.existsSync(this.modelsDir)) {
      return;
    }
    const entries = await fs.promises.readdir(this.modelsDir, { withFileTypes: true });
    const dirs = entries.filter(dir => dir.isDirectory());
    for (const d of dirs) {
      const modelEntries = await fs.promises.readdir(path.resolve(d.path, d.name));
      if (modelEntries.length !== 1) {
        // we support models with one file only for now
        continue;
      }
      const modelFile = modelEntries[0];
      const fullPath = path.resolve(d.path, d.name, modelFile);

      // Check for corresponding models or tmp file that should be ignored
      try {
        const model = this.modelsManager.getModelInfo(d.name);
        if (fullPath.endsWith('.tmp')) {
          continue;
        }

        let info: { size?: number; mtime?: Date } = { size: undefined, mtime: undefined };
        try {
          info = await fs.promises.stat(fullPath);
        } catch (err: unknown) {
          console.error('Something went wrong while getting file stats (probably in use).', err);
        }

        model.file = {
          file: modelFile,
          path: path.resolve(d.path, d.name),
          size: info.size,
          creation: info.mtime,
        };
      } catch (e: unknown) {
        console.warn(`Can't find model info for local folder ${d.name}.`, e);
      }
    }
  }

  async deleteModel(model: ModelInfo): Promise<void> {
    const folder = path.resolve(this.modelsDir, model.id);
    await fs.promises.rm(folder, { recursive: true, force: true, maxRetries: 3 });
  }
}
