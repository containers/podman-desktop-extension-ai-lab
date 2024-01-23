import type { LocalModelInfo } from '@shared/src/models/ILocalModelInfo';
import fs from 'fs';
import * as path from 'node:path';

export class ModelsManager {
  constructor(private appUserDirectory: string) {}

  getLocalModels(): LocalModelInfo[] {
    const result: LocalModelInfo[] = [];
    const modelsDir = path.join(this.appUserDirectory, 'models');
    const entries = fs.readdirSync(modelsDir, { withFileTypes: true });
    const dirs = entries.filter(dir => dir.isDirectory());
    for (const d of dirs) {
      const modelEntries = fs.readdirSync(path.resolve(d.path, d.name));
      if (modelEntries.length !== 1) {
        // we support models with one file only for now
        continue;
      }
      result.push({
        id: d.name,
        file: modelEntries[0],
      });
    }
    return result;
  }
}
