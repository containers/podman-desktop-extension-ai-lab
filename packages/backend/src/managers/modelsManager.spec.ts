import { type MockInstance, beforeEach, expect, test, vi } from 'vitest';
import os from 'os';
import fs from 'node:fs';
import path from 'node:path';
import { ModelsManager } from './modelsManager';

beforeEach(() => {
  vi.resetAllMocks();
});

test('getLocalModels should return models in local directory', () => {
  vi.spyOn(os, 'homedir').mockReturnValue('/home/user');
  const existsSyncSpy = vi.spyOn(fs, 'existsSync');
  existsSyncSpy.mockImplementation((path: string) => {
    expect(path).toBe('/home/user/aistudio/models');
    return true;
  });
  const readdirSyncMock = vi.spyOn(fs, 'readdirSync') as unknown as MockInstance<
    [path: string],
    string[] | fs.Dirent[]
  >;
  readdirSyncMock.mockImplementation((dir: string) => {
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
      ] as fs.Dirent[];
    }
  });
  const manager = new ModelsManager('/home/user/aistudio');
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

test('getLocalModels should return an empty array if the models folder does not exist', () => {
  vi.spyOn(os, 'homedir').mockReturnValue('/home/user');
  const existsSyncSpy = vi.spyOn(fs, 'existsSync');
  existsSyncSpy.mockImplementation((path: string) => {
    expect(path).toBe('/home/user/aistudio/models');
    return false;
  });
  const manager = new ModelsManager('/home/user/aistudio');
  const models = manager.getLocalModels();
  expect(models).toEqual([]);
  expect(existsSyncSpy).toHaveBeenCalledWith('/home/user/aistudio/models');
});
