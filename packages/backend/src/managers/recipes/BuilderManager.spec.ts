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
import type { Recipe } from '@shared/src/models/IRecipe';
import type { ContainerConfig } from '../../models/AIConfig';
import fs from 'node:fs';
import { BuilderManager } from './BuilderManager';
import type { TaskRegistry } from '../../registries/TaskRegistry';
import type { ImageInfo } from '@podman-desktop/api';
import { containerEngine } from '@podman-desktop/api';

const taskRegistry = {
  getTask: vi.fn(),
  createTask: vi.fn(),
  updateTask: vi.fn(),
  delete: vi.fn(),
  deleteAll: vi.fn(),
  getTasks: vi.fn(),
  getTasksByLabels: vi.fn(),
  deleteByLabels: vi.fn(),
} as unknown as TaskRegistry;

vi.mock('@podman-desktop/api', () => ({
  containerEngine: {
    buildImage: vi.fn(),
    listImages: vi.fn(),
  },
}));

beforeEach(() => {
  vi.resetAllMocks();

  vi.mocked(taskRegistry.createTask).mockImplementation((name, state, labels) => ({
    id: 'random',
    name: name,
    state: state,
    labels: labels ?? {},
    error: undefined,
  }));
});

describe('buildImages', () => {
  const recipe = {
    id: 'recipe1',
  } as Recipe;
  const containers: ContainerConfig[] = [
    {
      name: 'container1',
      contextdir: 'contextdir1',
      containerfile: 'Containerfile',
      arch: ['amd64'],
      modelService: false,
      gpu_env: [],
      ports: [8080],
    },
  ];
  const manager = new BuilderManager(taskRegistry);

  test('setTaskState should be called with error if context does not exist', async () => {
    vi.spyOn(fs, 'existsSync').mockReturnValue(false);
    vi.mocked(containerEngine.listImages).mockRejectedValue([]);
    await expect(manager.build(recipe, containers, 'config')).rejects.toThrow('Context configured does not exist.');
  });
  test('setTaskState should be called with error if buildImage executon fails', async () => {
    vi.spyOn(fs, 'existsSync').mockReturnValue(true);
    vi.mocked(containerEngine.buildImage).mockRejectedValue('error');
    vi.mocked(containerEngine.listImages).mockRejectedValue([]);

    await expect(manager.build(recipe, containers, 'config')).rejects.toThrow(
      'Something went wrong while building the image: error',
    );
    expect(taskRegistry.updateTask).toBeCalledWith({
      error: 'Something went wrong while building the image: error',
      name: 'Building container1',
      id: expect.any(String),
      state: expect.any(String),
      labels: {},
    });
  });
  test('setTaskState should be called with error if unable to find the image after built', async () => {
    vi.spyOn(fs, 'existsSync').mockReturnValue(true);
    vi.mocked(containerEngine.buildImage).mockResolvedValue({});
    vi.mocked(containerEngine.listImages).mockResolvedValue([]);

    await expect(manager.build(recipe, containers, 'config')).rejects.toThrow('no image found for container1:latest');
    expect(taskRegistry.updateTask).toBeCalledWith({
      error: 'no image found for container1:latest',
      name: 'Building container1',
      id: expect.any(String),
      state: expect.any(String),
      labels: {},
    });
  });
  test('succeed if building image do not fail', async () => {
    vi.spyOn(fs, 'existsSync').mockReturnValue(true);
    vi.mocked(containerEngine.buildImage).mockResolvedValue({});
    vi.mocked(containerEngine.listImages).mockResolvedValue([
      {
        RepoTags: ['recipe1-container1:latest'],
        engineId: 'engine',
        Id: 'id1',
      } as unknown as ImageInfo,
    ]);

    const imageInfoList = await manager.build(recipe, containers, 'config');
    expect(taskRegistry.updateTask).toBeCalledWith({
      name: 'Building container1',
      id: expect.any(String),
      state: 'success',
      labels: {},
    });
    expect(imageInfoList.length).toBe(1);
    expect(imageInfoList[0].ports.length).toBe(1);
    expect(imageInfoList[0].ports[0]).equals('8080');
  });
});
