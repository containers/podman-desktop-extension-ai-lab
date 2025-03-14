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
import { ModelHandler } from './ModelHandler';
import type { ModelInfo } from '@shared/src/models/IModelInfo';
import { Downloader } from '../utils/downloader';
import { scanCacheDir, snapshotDownload } from '@huggingface/hub';
import type { CompletionEvent } from './baseEvent';
import { getDurationSecondsSince } from '../utils/utils';
import type { ModelsManager } from '../managers/modelsManager';
import fs from 'node:fs/promises';

function parseURL(url: string): { repo: string; revision?: string } | undefined {
  const u = URL.parse(url);
  if (u) {
    return { repo: u.pathname.slice(1), revision: u.searchParams.get('revision') ?? 'main' };
  }
  return undefined;
}

class HuggingFaceDownloader extends Downloader {
  #target: string = '';

  constructor(
    url: string,
    private repo: string,
    private revision: string | undefined,
    private abortSignal: AbortSignal,
  ) {
    super(url, '');
  }

  override getTarget(): string {
    return this.#target;
  }

  async perform(id: string): Promise<void> {
    const startTime = performance.now();

    try {
      this.#target = await snapshotDownload({
        repo: this.repo,
        revision: this.revision,
      });
      const durationSeconds = getDurationSecondsSince(startTime);
      this._onEvent.fire({
        id: id,
        status: 'completed',
        message: `Duration ${durationSeconds}s.`,
        duration: durationSeconds,
      } as CompletionEvent);
    } catch (err: unknown) {
      if (!this.abortSignal?.aborted) {
        this._onEvent.fire({
          id: id,
          status: 'error',
          message: `Something went wrong: ${String(err)}.`,
        });
      } else {
        this._onEvent.fire({
          id: id,
          status: 'canceled',
          message: `Request cancelled: ${String(err)}.`,
        });
      }
      throw err;
    } finally {
      this.completed = true;
    }
  }
}

export class HuggingFaceModelHandler extends ModelHandler {
  constructor(modelsManager: ModelsManager) {
    super('huggingface model registry', modelsManager);
  }

  accept(url: string): boolean {
    return url.startsWith('huggingface') || url.startsWith('hf');
  }

  createDownloader(model: ModelInfo, abortSignal: AbortSignal): Downloader {
    const result = parseURL(model.url!);
    if (result) {
      return new HuggingFaceDownloader(model.url!, result.repo, result.revision, abortSignal);
    }
    throw new Error(`Invalid URL: ${model.url} for model ${model.name}`);
  }

  async deleteModel(model: ModelInfo): Promise<void> {
    if (model.file) {
      await fs.rm(model.file?.path, { recursive: true });
    }
  }

  dispose(): void {}

  async getLocalModelsFromDisk(): Promise<void> {
    const hfModels = this.modelsManager
      .getModelsInfo()
      .filter(model => model.url && this.accept(model.url))
      .map(model => {
        return { model: model, repo: parseURL(model.url!) };
      })
      .filter(info => info.repo);

    scanCacheDir()
      .then(hfinfo => {
        for (const repo of hfinfo.repos) {
          for (const revision of repo.revisions) {
            for (const ref of revision.refs) {
              const model = hfModels.find(m => m.repo?.repo === repo.id.name && m.repo?.revision === ref);
              if (model) {
                model.model.file = {
                  path: revision.path,
                  file: revision.path,
                  creation: revision.lastModifiedAt,
                  size: revision.size,
                };
              }
            }
          }
        }
      })
      .catch((err: unknown): void => {
        console.error('Something went wrong while scanning cache.', err);
      });
  }
}
