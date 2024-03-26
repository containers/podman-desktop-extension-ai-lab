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
import { expect, test, vi, beforeEach } from 'vitest';

import { render, screen, fireEvent } from '@testing-library/svelte';
import SystemPromptBanner from '/@/lib/conversation/SystemPromptBanner.svelte';
import { studioClient } from '/@/utils/client';

vi.mock('../../utils/client', async () => {
  return {
    studioClient: {
      setPlaygroundSystemPrompt: vi.fn(),
    },
  };
});

beforeEach(() => {
  vi.resetAllMocks();
  vi.mocked(studioClient.setPlaygroundSystemPrompt).mockResolvedValue(undefined);
});

test('render empty conversation, hidden textarea', () => {
  render(SystemPromptBanner, {
    conversation: {
      id: 'dummyId',
      messages: [],
    },
  });

  const textbox = screen.getByRole('textbox');
  expect(textbox).toHaveClass('hidden');

  const alert = screen.getByRole('alert');
  expect(alert).toHaveClass('hidden');
});

test('empty conversation click on edit should reveal textarea', async () => {
  render(SystemPromptBanner, {
    conversation: {
      id: 'dummyId',
      messages: [],
    },
  });
  const editBtn = screen.getByTitle('Edit system prompt');
  await fireEvent.click(editBtn);

  const textbox = screen.getByRole('textbox');
  await vi.waitFor(() => {
    expect(textbox).not.toHaveClass('hidden');
  });
});

test('input in textarea should be sent to backend when valid click', async () => {
  render(SystemPromptBanner, {
    conversation: {
      id: 'dummyId',
      messages: [],
    },
  });
  const editBtn = screen.getByTitle('Edit system prompt');
  await fireEvent.click(editBtn);

  const textbox = screen.getByRole('textbox');
  await vi.waitFor(() => {
    expect(textbox).not.toHaveClass('hidden');
  });

  await fireEvent.input(textbox, { target: { value: 'dummyInputValue' } });
  await fireEvent.click(editBtn);

  await vi.waitFor(() => {
    expect(studioClient.setPlaygroundSystemPrompt).toHaveBeenCalledWith('dummyId', 'dummyInputValue');
  });
});

test('error message should be visible if submit empty', async () => {
  render(SystemPromptBanner, {
    conversation: {
      id: 'dummyId',
      messages: [],
    },
  });
  const editBtn = screen.getByTitle('Edit system prompt');
  await fireEvent.click(editBtn);

  const textbox = screen.getByRole('textbox');
  await vi.waitFor(() => {
    expect(textbox).not.toHaveClass('hidden');
  });

  await fireEvent.click(editBtn);

  await vi.waitFor(() => {
    const alert = screen.getByRole('alert');
    expect(alert).not.toHaveClass('hidden');
    expect(alert.textContent).toBe('System prompt is too short.');
  });
});

test('clear button should reset editing state', async () => {
  render(SystemPromptBanner, {
    conversation: {
      id: 'dummyId',
      messages: [],
    },
  });
  const editBtn = screen.getByTitle('Edit system prompt');
  await fireEvent.click(editBtn);

  const textbox = screen.getByRole('textbox');
  await vi.waitFor(() => {
    expect(textbox).not.toHaveClass('hidden');
  });

  const clearBtn = screen.getByTitle('Clear');
  await fireEvent.click(clearBtn);

  await vi.waitFor(() => {
    expect(textbox).toHaveClass('hidden');
  });
  expect(studioClient.setPlaygroundSystemPrompt).not.toHaveBeenCalled();
});

test('clear button should set system prompt undefined if already exist', async () => {
  render(SystemPromptBanner, {
    conversation: {
      id: 'dummyId',
      messages: [{
        id: 'random',
        content: 'existing',
        role: 'system',
        timestamp: 0,
      }],
    },
  });
  const editBtn = screen.getByTitle('Edit system prompt');
  await fireEvent.click(editBtn);

  const textbox = screen.getByRole('textbox');
  await vi.waitFor(() => {
    expect(textbox).not.toHaveClass('hidden');
  });

  const clearBtn = screen.getByTitle('Clear');
  await fireEvent.click(clearBtn);

  await vi.waitFor(() => {
    expect(textbox).toHaveClass('hidden');
  });
  expect(studioClient.setPlaygroundSystemPrompt).toHaveBeenCalledWith('dummyId', undefined);
});

test('error message should be cleared if input change', async () => {
  render(SystemPromptBanner, {
    conversation: {
      id: 'dummyId',
      messages: [],
    },
  });
  const editBtn = screen.getByTitle('Edit system prompt');
  await fireEvent.click(editBtn);

  const textbox = screen.getByRole('textbox');
  await vi.waitFor(() => {
    expect(textbox).not.toHaveClass('hidden');
  });

  await fireEvent.click(editBtn);

  const alert = screen.getByRole('alert');
  await vi.waitFor(() => {
    expect(alert).not.toHaveClass('hidden');
  });

  await fireEvent.input(textbox, { target: { value: 'dummyInputValue' } });
  await vi.waitFor(() => {
    expect(alert).toHaveClass('hidden');
  });
});
