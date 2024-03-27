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
  getRemoteModelFile,
  isModelUploaded,
  MACHINE_BASE_FOLDER,
} from './modelsUtils';
import type { ModelInfo } from '@shared/src/models/IModelInfo';
import { getPodmanCli } from './podman';

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
