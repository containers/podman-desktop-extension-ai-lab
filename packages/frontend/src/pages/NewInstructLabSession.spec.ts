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

import '@testing-library/jest-dom/vitest';
import { vi, test, expect, beforeEach, describe } from 'vitest';
import { fireEvent, render } from '@testing-library/svelte';
import type { ModelInfo } from '@shared/models/IModelInfo';
import NewInstructLabSession from '/@/pages/NewInstructLabSession.svelte';
import { writable, type Writable } from 'svelte/store';
import { modelsInfo } from '/@/stores/modelsInfo';
import { studioClient } from '/@/utils/client';
import type { Uri } from '@shared/uri/Uri';
import type { RenderResult } from '@testing-library/svelte';
import { router } from 'tinro';

vi.mock('../stores/modelsInfo', async () => ({
  modelsInfo: {
    subscribe: vi.fn(),
    unsubscribe: vi.fn(),
  },
}));

vi.mock('tinro', () => ({
  router: {
    goto: vi.fn(),
  },
}));

vi.mock('../utils/client', async () => ({
  studioClient: {
    openURL: vi.fn(),
    openDialog: vi.fn(),
  },
}));

beforeEach(() => {
  vi.resetAllMocks();

  const infos: Writable<ModelInfo[]> = writable([]);
  vi.mocked(modelsInfo).subscribe.mockImplementation(run => infos.subscribe(run));
});

test('empty form should have submit disabled', async () => {
  const { getByTitle } = render(NewInstructLabSession);

  const submit = getByTitle('Start session');
  expect(submit).toBeDefined();
  expect(submit).toBeDisabled();
});

test('breadcrumb click should goto sessions list', async () => {
  const { getByRole } = render(NewInstructLabSession);

  const back = getByRole('link', { name: 'Back' });
  expect(back).toBeDefined();

  await fireEvent.click(back);

  expect(router.goto).toHaveBeenCalledWith('/tune');
});

describe('radio selection', () => {
  test('expect knowledge radio to be selected by default', async () => {
    const { getByTitle } = render(NewInstructLabSession);

    const selectKnowledgeFile = getByTitle('Select knowledge file');
    expect(selectKnowledgeFile).toBeDefined();
    expect(selectKnowledgeFile).toBeEnabled();

    const selectSkillFile = getByTitle('Select skills file');
    expect(selectSkillFile).toBeDefined();
    expect(selectSkillFile).toBeDisabled();
  });

  test('expect knowledge to be disabled if user select skills', async () => {
    const { getByTitle } = render(NewInstructLabSession);

    const useSkills = getByTitle('Use Skills');
    expect(useSkills).toBeDefined();
    await fireEvent.click(useSkills);

    const selectKnowledgeFile = getByTitle('Select knowledge file');
    expect(selectKnowledgeFile).toBeDefined();
    expect(selectKnowledgeFile).toBeDisabled();
  });
});

/**
 * The file selection is the same for knowledge and skills so using each
 */
describe.each(['knowledge', 'skills'])('file selection %s', (type: string) => {
  /**
   * This function render the NewInstructLabSession with the radio expected selected (either skills or knowledge
   */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  async function renderForm(): Promise<RenderResult<any>> {
    const renderResult = render(NewInstructLabSession);

    if (type === 'skills') {
      const useSkills = renderResult.getByTitle('Use Skills');
      expect(useSkills).toBeDefined();
      await fireEvent.click(useSkills);
    }

    return renderResult;
  }

  test(`click on select ${type} should open dialog`, async () => {
    vi.mocked(studioClient.openDialog).mockResolvedValue([]);

    const { getByTitle } = await renderForm();

    const selectKnowledgeFile = getByTitle(`Select ${type} file`);
    expect(selectKnowledgeFile).toBeDefined();
    expect(selectKnowledgeFile).toBeEnabled();

    await fireEvent.click(selectKnowledgeFile);

    expect(studioClient.openDialog).toHaveBeenCalledWith({
      title: `Select ${type}`,
      selectors: ['openFile'],
      filters: [
        {
          name: 'YAML files',
          extensions: ['yaml', 'YAML', 'yml'],
        },
      ],
    });
  });

  test(`expect ${type} to be added on selection`, async () => {
    const file = '/random/folder/resource.yaml';
    vi.mocked(studioClient.openDialog).mockResolvedValue([
      {
        path: file,
      },
    ] as Uri[]);
    const { getByTitle, getByText } = await renderForm();

    const selectKnowledgeFile = getByTitle(`Select ${type} file`);
    await fireEvent.click(selectKnowledgeFile);

    expect(studioClient.openDialog).toHaveBeenCalled();

    const span = getByText(file);
    expect(span).toBeEnabled();
  });

  test(`expect multiple ${type} to be added on multi selection`, async () => {
    const files = ['/random/folder/resource1.yaml', '/random/folder/resource2.yaml', '/random/folder/resource3.yaml'];
    vi.mocked(studioClient.openDialog).mockResolvedValue(
      files.map(file => ({
        path: file,
      })) as Uri[],
    );
    const { getByTitle, getByText } = await renderForm();

    const selectKnowledgeFile = getByTitle(`Select ${type} file`);
    await fireEvent.click(selectKnowledgeFile);

    expect(studioClient.openDialog).toHaveBeenCalled();

    for (const file of files) {
      const span = getByText(file);
      expect(span).toBeDefined();
    }
  });

  test('remove file button should remove a given file', async () => {
    const files = ['/random/folder/resource1.yaml', '/random/folder/resource2.yaml'];
    vi.mocked(studioClient.openDialog).mockResolvedValue(
      files.map(file => ({
        path: file,
      })) as Uri[],
    );
    const { getByTitle, queryByText } = await renderForm();

    const selectKnowledgeFile = getByTitle(`Select ${type} file`);
    await fireEvent.click(selectKnowledgeFile);

    expect(studioClient.openDialog).toHaveBeenCalled();

    const removeBtn = getByTitle(`Remove ${files[1]}`);
    expect(removeBtn).toBeEnabled();
    if (!removeBtn) throw new Error('undefined remove btn');

    await fireEvent.click(removeBtn);

    await vi.waitFor(() => {
      expect(queryByText(files[1])).toBeNull();
    });
  });
});
