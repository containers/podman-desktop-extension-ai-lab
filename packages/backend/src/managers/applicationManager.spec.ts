import { expect, test, vi } from 'vitest';
import { ApplicationManager } from './applicationManager';
import type { RecipeStatusRegistry } from '../registries/RecipeStatusRegistry';
import type { ExtensionContext } from '@podman-desktop/api';
import type { GitManager } from './gitManager';
import os from 'os';
import fs, { type Dirent } from 'fs';
import path from 'path';

test('appUserDirectory should be under home directory', () => {
  vi.spyOn(os, 'homedir').mockReturnValue('/home/user');
  const manager = new ApplicationManager({} as GitManager, {} as RecipeStatusRegistry, {} as ExtensionContext);
  expect(manager.appUserDirectory).toMatch(/^(\/|\\)home(\/|\\)user/);
});

test('getLocalModels should return models in local directory', () => {
  vi.spyOn(os, 'homedir').mockReturnValue('/home/user');
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  vi.spyOn(fs, 'readdirSync').mockImplementation((dir: string): any => {
    // TODO(feloy): fix any
    if (dir.endsWith('model-id-1') || dir.endsWith('model-id-2')) {
      const base = path.basename(dir);
      return [base + '-model'];
    } else {
      return [
        {
          isDirectory: () => true,
          path: '/home/user/appstudio-dir',
          name: 'model-id-1',
        },
        {
          isDirectory: () => true,
          path: '/home/user/appstudio-dir',
          name: 'model-id-2',
        },
        {
          isDirectory: () => false,
          path: '/home/user/appstudio-dir',
          name: 'other-file-should-be-ignored.txt',
        },
      ] as Dirent[];
    }
  });
  const manager = new ApplicationManager({} as GitManager, {} as RecipeStatusRegistry, {} as ExtensionContext);
  const models = manager.getLocalModels();
  expect(models).toEqual([
    {
      id: 'model-id-1',
      file: 'model-id-1-model',
    },
    {
      id: 'model-id-2',
      file: 'model-id-2-model',
    },
  ]);
});
