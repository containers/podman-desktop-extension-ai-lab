import type { LocalModelInfo } from '@shared/src/models/ILocalModelInfo';
import fs from 'fs';
import * as path from 'node:path';
import { type Webview, fs as apiFs } from '@podman-desktop/api';
import { MSG_NEW_LOCAL_MODELS_STATE } from '@shared/Messages';
import type { CatalogManager } from './catalogManager';

export class ModelsManager {
  #modelsDir: string;
  #localModels: Map<string, LocalModelInfo>;

  constructor(
    private appUserDirectory: string,
    private webview: Webview,
    private catalogManager: CatalogManager,
  ) {
    this.#modelsDir = path.join(this.appUserDirectory, 'models');
    this.#localModels = new Map();
  }

  async loadLocalModels() {
    const reloadLocalModels = async () => {
      this.getLocalModelsFromDisk();
      const models = this.getModelsInfo();
      await this.webview.postMessage({
        id: MSG_NEW_LOCAL_MODELS_STATE,
        body: models,
      });
    };
    const watcher = apiFs.createFileSystemWatcher(this.#modelsDir);
    watcher.onDidCreate(reloadLocalModels);
    watcher.onDidDelete(reloadLocalModels);
    watcher.onDidChange(reloadLocalModels);
    // Initialize the local models manually
    await reloadLocalModels();
  }

  getModelsInfo() {
    return this.catalogManager
      .getModels()
      .filter(m => this.#localModels.has(m.id))
      .map(m => ({ ...m, file: this.#localModels.get(m.id) }));
  }

  getLocalModelsFromDisk(): void {
    if (!fs.existsSync(this.#modelsDir)) {
      return;
    }
    const result = new Map<string, LocalModelInfo>();
    const entries = fs.readdirSync(this.#modelsDir, { withFileTypes: true });
    const dirs = entries.filter(dir => dir.isDirectory());
    for (const d of dirs) {
      const modelEntries = fs.readdirSync(path.resolve(d.path, d.name));
      if (modelEntries.length !== 1) {
        // we support models with one file only for now
        continue;
      }
      const modelFile = modelEntries[0];
      const info = fs.statSync(path.resolve(d.path, d.name, modelFile));
      result.set(d.name, {
        id: d.name,
        file: modelFile,
        size: info.size,
        creation: info.mtime,
      });
    }
    this.#localModels = result;
  }

  isModelOnDisk(modelId: string) {
    return this.#localModels.has(modelId);
  }

  getLocalModelInfo(modelId: string): LocalModelInfo {
    if (!this.isModelOnDisk(modelId)) {
      throw new Error('model is not on disk');
    }
    return this.#localModels.get(modelId);
  }

  getLocalModelPath(modelId: string): string {
    const info = this.getLocalModelInfo(modelId);
    return path.resolve(this.#modelsDir, modelId, info.file);
  }

  getLocalModels(): LocalModelInfo[] {
    return Array.from(this.#localModels.values());
  }
}
