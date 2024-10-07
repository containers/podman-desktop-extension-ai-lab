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
import { vi, test, expect, beforeEach } from 'vitest';
import { fireEvent, render } from '@testing-library/svelte';
import type { ModelInfo } from '@shared/src/models/IModelInfo';
import NewInstructLabSession from '/@/pages/NewInstructLabSession.svelte';

const mocks = vi.hoisted(() => {
  return {
    // models store
    modelsInfoSubscribeMock: vi.fn<() => ModelInfo[]>(),
    modelsInfoQueriesMock: {
      subscribe: (f: (msg: unknown) => void) => {
        f(mocks.modelsInfoSubscribeMock());
        return (): void => {};
      },
    },
  };
});

vi.mock('../stores/modelsInfo', async () => {
  return {
    modelsInfo: mocks.modelsInfoQueriesMock,
  };
});

vi.mock('../utils/client', async () => ({
  studioClient: {

  },
}));

beforeEach(() => {
  mocks.modelsInfoSubscribeMock.mockReturnValue([]);
});

test('empty form should have submit disabled', async () => {
  const { getByTitle } = render(NewInstructLabSession);

  const submit = getByTitle('Start session');
  expect(submit).toBeDefined();
  expect(submit).toBeDisabled();
});

test('expect knowledge radio to be selected by default', async () => {
  const { getByTitle } = render(NewInstructLabSession);

  const selectKnowledgeFile = getByTitle('Select knowledge file');
  expect(selectKnowledgeFile).toBeDefined();
  expect(selectKnowledgeFile).toBeEnabled();

  const selectSkillFile = getByTitle('Select skill file');
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

