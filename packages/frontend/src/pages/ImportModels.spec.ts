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

import ImportModels from './ImportModels.svelte';
import type { Uri } from '@shared/src/uri/Uri';

vi.mock('../utils/client', async () => {
  return {
    studioClient: {
      openDialog: vi.fn(),
      importModels: vi.fn(),
      checkInvalidModels: vi.fn(),
    },
  };
});

beforeEach(() => {
  vi.clearAllMocks();
});

test('Expect import button to be disabled', async () => {
  render(ImportModels);
  const btnImportModels = screen.getByRole('button', { name: 'Import models' });
  expect(btnImportModels).toBeInTheDocument();
  expect(btnImportModels).toBeDisabled();
});

test('Expect importModels button to be enabled when atleast one model is selected', async () => {
  vi.mocked(studioClient.openDialog).mockResolvedValue([
    {
      path: 'path/file.gguf',
    } as Uri,
  ]);
  vi.mocked(studioClient.checkInvalidModels).mockResolvedValue([]);
  render(ImportModels);
  const btnAddModels = screen.getByRole('button', { name: 'Add models' });
  expect(btnAddModels).toBeInTheDocument();
  await userEvent.click(btnAddModels);

  const btnImportModels = screen.getByRole('button', { name: 'Import models' });
  expect(btnImportModels).toBeInTheDocument();
  expect(btnImportModels).toBeEnabled();
});

test('Expect import button calls importModels func', async () => {
  vi.mocked(studioClient.openDialog).mockResolvedValue([
    {
      path: 'path/file.gguf',
    } as Uri,
  ]);
  vi.mocked(studioClient.checkInvalidModels).mockResolvedValue([]);
  vi.mocked(studioClient.importModels).mockResolvedValue();
  const goToMock = vi.spyOn(router, 'goto');
  render(ImportModels);
  const btnAddModels = screen.getByRole('button', { name: 'Add models' });
  expect(btnAddModels).toBeInTheDocument();
  await userEvent.click(btnAddModels);

  const btnImportModels = screen.getByRole('button', { name: 'Import models' });
  expect(btnImportModels).toBeInTheDocument();
  expect(btnImportModels).toBeEnabled();
  await userEvent.click(btnImportModels);

  expect(studioClient.importModels).toBeCalledWith([
    {
      name: 'file',
      path: 'path/file.gguf',
    },
  ]);
  expect(goToMock).toBeCalledWith('/models');
});

test('Expect error shown if importModels function fails', async () => {
  vi.mocked(studioClient.openDialog).mockResolvedValue([
    {
      path: 'path/file.gguf',
    } as Uri,
  ]);
  vi.mocked(studioClient.checkInvalidModels).mockResolvedValue([]);
  vi.mocked(studioClient.importModels).mockRejectedValue('import failed');
  render(ImportModels);
  const btnAddModels = screen.getByRole('button', { name: 'Add models' });
  expect(btnAddModels).toBeInTheDocument();
  await userEvent.click(btnAddModels);

  const btnImportModels = screen.getByRole('button', { name: 'Import models' });
  expect(btnImportModels).toBeInTheDocument();
  expect(btnImportModels).toBeEnabled();
  await userEvent.click(btnImportModels);

  expect(studioClient.importModels).toBeCalledWith([
    {
      name: 'file',
      path: 'path/file.gguf',
    },
  ]);

  const errorDiv = screen.getByLabelText('Error Message Content');
  expect(errorDiv).toBeInTheDocument();
  expect((errorDiv as HTMLDivElement).innerHTML).toContain('import failed');
});
