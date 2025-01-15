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
import { beforeEach, describe, expect, test, vi } from 'vitest';
import { process as apiProcess } from '@podman-desktop/api';
import {
  deleteRemoteModel,
  getLocalModelFile,
  getMountPath,
  getRemoteModelFile,
  isModelUploaded,
  MACHINE_BASE_FOLDER,
} from './modelsUtils';
import type { ModelInfo } from '@shared/src/models/IModelInfo';
import { getPodmanCli } from './podman';
import { join, posix } from 'node:path';

vi.mock('@podman-desktop/api', () => {
  return {
    process: {
      exec: vi.fn(),
    },
  };
});

vi.mock('./podman', () => ({
  getPodmanCli: vi.fn(),
}));

beforeEach(() => {
  vi.resetAllMocks();

  vi.mocked(getPodmanCli).mockReturnValue('dummyPodmanCli');
});

describe('getLocalModelFile', () => {
  test('file in ModelInfo undefined', () => {
    expect(() => {
      getLocalModelFile({
        id: 'dummyModelId',
        file: undefined,
      } as unknown as ModelInfo);
    }).toThrowError('model is not available locally.');
  });

  test('should join path with respect to system host', () => {
    const path = getLocalModelFile({
      id: 'dummyModelId',
      file: {
        path: 'dummyPath',
        file: 'dummy.guff',
      },
    } as unknown as ModelInfo);

    if (process.platform === 'win32') {
      expect(path).toBe('dummyPath\\dummy.guff');
    } else {
      expect(path).toBe('dummyPath/dummy.guff');
    }
  });
});

describe('getMountPath', () => {
  const DUMMY_MODEL: ModelInfo = {
    id: 'dummyModelId',
    file: undefined,
    properties: {},
    description: '',
    name: 'dummy-model',
  };

  const DOWNLOADED_MODEL: ModelInfo & { file: { path: string; file: string } } = {
    ...DUMMY_MODEL,
    file: {
      path: 'dummyPath',
      file: 'dummy.guff',
    },
  };

  const UPLOADED_MODEL: ModelInfo & { file: { path: string; file: string } } = {
    ...DUMMY_MODEL,
    file: {
      path: MACHINE_BASE_FOLDER,
      file: 'dummy.guff',
    },
  };

  test('file in ModelInfo undefined', () => {
    expect(() => {
      getMountPath(DUMMY_MODEL);
    }).toThrowError('model is not available locally.');
  });

  test('should join path with respect to system host', () => {
    const path = getMountPath(DOWNLOADED_MODEL);
    expect(path).toBe(join(DOWNLOADED_MODEL.file.path, DOWNLOADED_MODEL.file.file));
  });

  test('uploaded model should use posix for join path', () => {
    const path = getMountPath(UPLOADED_MODEL);
    expect(path).toBe(posix.join(MACHINE_BASE_FOLDER, UPLOADED_MODEL.file.file));
  });
});

describe('getRemoteModelFile', () => {
  test('file in ModelInfo undefined', () => {
    expect(() => {
      getRemoteModelFile({
        id: 'dummyModelId',
        file: undefined,
      } as unknown as ModelInfo);
    }).toThrowError('model is not available locally.');
  });

  test('should join path using posix', () => {
    const path = getRemoteModelFile({
      id: 'dummyModelId',
      file: {
        path: 'dummyPath',
        file: 'dummy.guff',
      },
    } as unknown as ModelInfo);

    expect(path).toBe(`${MACHINE_BASE_FOLDER}dummy.guff`);
  });
});

describe('isModelUploaded', () => {
  test('execute stat on targeted machine', async () => {
    expect(
      await isModelUploaded('dummyMachine', {
        id: 'dummyModelId',
        file: {
          path: 'dummyPath',
          file: 'dummy.guff',
        },
      } as unknown as ModelInfo),
    ).toBeTruthy();

    expect(getPodmanCli).toHaveBeenCalled();
    expect(apiProcess.exec).toHaveBeenCalledWith('dummyPodmanCli', [
      'machine',
      'ssh',
      'dummyMachine',
      'stat',
      expect.anything(),
    ]);
  });
});

describe('deleteRemoteModel', () => {
  test('execute stat on targeted machine', async () => {
    await deleteRemoteModel('dummyMachine', {
      id: 'dummyModelId',
      file: {
        path: 'dummyPath',
        file: 'dummy.guff',
      },
    } as unknown as ModelInfo);

    expect(getPodmanCli).toHaveBeenCalled();
    expect(apiProcess.exec).toHaveBeenCalledWith('dummyPodmanCli', [
      'machine',
      'ssh',
      'dummyMachine',
      'rm',
      '-f',
      expect.anything(),
    ]);
  });
});
