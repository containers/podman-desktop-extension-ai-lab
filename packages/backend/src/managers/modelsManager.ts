import type { LocalModelInfo } from '@shared/src/models/ILocalModelInfo';
import fs from 'fs';
import * as path from 'node:path';

export class ModelsManager {
  constructor(private appUserDirectory: string) {}

  getLocalModels(): LocalModelInfo[] {
    const result: LocalModelInfo[] = [];
    const modelsDir = path.join(this.appUserDirectory, 'models');
    if (!fs.existsSync(modelsDir)) {
      return [];
    }
    const entries = fs.readdirSync(modelsDir, { withFileTypes: true });
    const dirs = entries.filter(dir => dir.isDirectory());
    for (const d of dirs) {
      const modelEntries = fs.readdirSync(path.resolve(d.path, d.name));
      if (modelEntries.length !== 1) {
        // we support models with one file only for now
        continue;
      }
      const modelFile = modelEntries[0];
      const info = fs.statSync(path.resolve(d.path, d.name, modelFile));
      result.push({
        id: d.name,
        file: modelFile,
        size: info.size,
        creation: info.mtime,
      });
    }
    return result;
  }
}
