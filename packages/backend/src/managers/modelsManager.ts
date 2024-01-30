import type { LocalModelInfo } from '@shared/src/models/ILocalModelInfo';
import fs from 'fs';
import * as path from 'node:path';
import { type Webview, fs as apiFs } from '@podman-desktop/api';
import { MSG_NEW_LOCAL_MODELS_STATE } from '@shared/Messages';
import type { CatalogManager } from './catalogManager';
import type { ModelInfo } from '@shared/src/models/IModelInfo';
import * as podmanDesktopApi from '@podman-desktop/api';

export class ModelsManager {
  #modelsDir: string;
  #localModels: Map<string, LocalModelInfo>;
  // models being deleted
  #deleted: Set<string>;

  constructor(
    private appUserDirectory: string,
    private webview: Webview,
    private catalogManager: CatalogManager,
  ) {
    this.#modelsDir = path.join(this.appUserDirectory, 'models');
    this.#localModels = new Map();
    this.#deleted = new Set();
  }

  async loadLocalModels() {
    const reloadLocalModels = async () => {
      this.getLocalModelsFromDisk();
      await this.sendModelsInfo();
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
      .map(
        m =>
          ({
            ...m,
            file: this.#localModels.get(m.id),
            state: this.#deleted.has(m.id) ? 'deleting' : undefined,
          }) as ModelInfo,
      );
  }

  async sendModelsInfo() {
    const models = this.getModelsInfo();
    await this.webview.postMessage({
      id: MSG_NEW_LOCAL_MODELS_STATE,
      body: models,
    });
  }

  getModelsDirectory(): string {
    return this.#modelsDir;
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
      const fullPath = path.resolve(d.path, d.name, modelFile);
      const info = fs.statSync(fullPath);
      result.set(d.name, {
        id: d.name,
        file: modelFile,
        path: path.resolve(d.path, d.name),
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

  getLocalModelFolder(modelId: string): string {
    return path.resolve(this.#modelsDir, modelId);
  }

  getLocalModels(): LocalModelInfo[] {
    return Array.from(this.#localModels.values());
  }

  async deleteLocalModel(modelId: string): Promise<void> {
    const modelDir = this.getLocalModelFolder(modelId);
    this.#deleted.add(modelId);
    await this.sendModelsInfo();
    try {
      await fs.promises.rm(modelDir, { recursive: true });
      this.#localModels.delete(modelId);
    } catch (err: unknown) {
      await podmanDesktopApi.window.showErrorMessage(`Error deleting model ${modelId}. ${String(err)}`);
    } finally {
      this.#deleted.delete(modelId);
      await this.sendModelsInfo();
    }
  }
}
