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
import type { Disposable } from '@podman-desktop/api';
import { EventEmitter } from '@podman-desktop/api';
import type { Downloader } from '../utils/downloader';
import type { ModelInfo } from '@shared/src/models/IModelInfo';
import type { ModelsManager } from '../managers/modelsManager';

export abstract class ModelRegistry implements Disposable {
  readonly name: string;
  readonly modelsManager: ModelsManager;
  protected _onUpdate = new EventEmitter<void>();
  readonly onUpdate = this._onUpdate.event;

  protected constructor(name: string, modelsManager: ModelsManager) {
    this.name = name;
    this.modelsManager = modelsManager;
  }

  abstract dispose(): void;

  abstract accept(url: string): boolean;

  abstract createDownloader(model: ModelInfo, abortSignal: AbortSignal): Downloader;

  abstract getLocalModelsFromDisk(): Promise<void>;

  abstract deleteModel(model: ModelInfo): Promise<void>;
}
