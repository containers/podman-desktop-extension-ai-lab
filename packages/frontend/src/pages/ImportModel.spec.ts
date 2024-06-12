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

/* eslint-disable @typescript-eslint/no-explicit-any */

import '@testing-library/jest-dom/vitest';

import { render, screen } from '@testing-library/svelte';
import userEvent from '@testing-library/user-event';
import { router } from 'tinro';
import { beforeEach, expect, test, vi } from 'vitest';
import { studioClient } from '../utils/client';

import ImportModels from './ImportModel.svelte';
import type { Uri } from '@shared/src/uri/Uri';

vi.mock('../utils/client', async () => {
  return {
    studioClient: {
      openDialog: vi.fn(),
      importModels: vi.fn(),
      validateLocalModel: vi.fn(),
    },
  };
});

vi.mock('tinro', () => ({
  router: {
    goto: vi.fn(),
  },
}));

beforeEach(() => {
  vi.clearAllMocks();
  // mock validateLocalModel
  vi.mocked(studioClient.validateLocalModel).mockResolvedValue(undefined);
});

test('Expect import button to be disabled', async () => {
  render(ImportModels);
  const btnImportModels = screen.getByRole('button', { name: 'Import model' });
  expect(btnImportModels).toBeInTheDocument();
  expect(btnImportModels).toBeDisabled();
});

test('Expect importModel button to be enabled when model selected', async () => {
  vi.mocked(studioClient.openDialog).mockResolvedValue([
    {
      path: 'path/file.gguf',
    } as Uri,
  ]);
  vi.mocked(studioClient.validateLocalModel).mockResolvedValue(undefined);

  render(ImportModels);
  const btnOpenFileExplorer = screen.getByRole('button', { name: 'model input' });
  expect(btnOpenFileExplorer).toBeInTheDocument();

  // click on open file explorer
  await userEvent.click(btnOpenFileExplorer);

  await vi.waitFor(() => {
    const btnImportModels = screen.getByRole('button', { name: 'Import model' });
    expect(btnImportModels).toBeInTheDocument();
    expect(btnImportModels).not.toBeDisabled();
  });
});

test('Expect import submit to call studioClient.importModels', async () => {
  vi.mocked(studioClient.openDialog).mockResolvedValue([
    {
      path: 'path/file.gguf',
    } as Uri,
  ]);

  render(ImportModels);
  const btnOpenFileExplorer = screen.getByRole('button', { name: 'model input' });
  await userEvent.click(btnOpenFileExplorer);

  const btnImportModels = screen.getByRole('button', { name: 'Import model' });

  await vi.waitFor(() => {
    expect(btnImportModels).toBeInTheDocument();
    expect(btnImportModels).not.toBeDisabled();
  });

  // submit model
  await userEvent.click(btnImportModels);

  await vi.waitFor(() => {
    expect(studioClient.importModels).toHaveBeenCalledWith([
      {
        path: 'path/file.gguf',
        name: 'file',
        backend: 'llama-cpp',
      },
    ]);
  });
  expect(router.goto).toHaveBeenCalledWith('/models/imported');
});
