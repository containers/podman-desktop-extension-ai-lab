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
import { expect, test, vi, beforeEach, describe } from 'vitest';

import { render, within, fireEvent, waitFor } from '@testing-library/svelte';
import CopyButton from '/@/lib/button/CopyButton.svelte';
import { studioClient } from '/@/utils/client';

vi.mock('../../utils/client', async () => ({
  studioClient: {
    copyToClipboard: vi.fn(),
  },
}));

beforeEach(() => {
  vi.resetAllMocks();

  vi.mocked(studioClient.copyToClipboard).mockResolvedValue(undefined);
});

test('clicking on the content should call copyToClipboard', async () => {
  const { container } = render(CopyButton, {
    content: 'dummy-content',
  });

  const cpyButton = within(container).getByRole('button');
  expect(cpyButton).toBeDefined();

  await fireEvent.click(cpyButton);

  await waitFor(() => {
    expect(studioClient.copyToClipboard).toHaveBeenCalledWith('dummy-content');
  });
});

describe('tooltips properties should be propagated', () => {
  test('top property', async () => {
    const { container } = render(CopyButton, {
      content: 'dummy-content',
      top: true,
    });

    const toolTip = container.querySelector('.tooltip.top');
    expect(toolTip).toBeDefined();
  });

  test('topLeft property', async () => {
    const { container } = render(CopyButton, {
      content: 'dummy-content',
      topLeft: true,
    });

    const toolTip = container.querySelector('.tooltip.top-left');
    expect(toolTip).toBeDefined();
  });

  test('topRight property', async () => {
    const { container } = render(CopyButton, {
      content: 'dummy-content',
      topRight: true,
    });

    const toolTip = container.querySelector('.tooltip.top-right');
    expect(toolTip).toBeDefined();
  });

  test('right property', async () => {
    const { container } = render(CopyButton, {
      content: 'dummy-content',
      right: true,
    });

    const toolTip = container.querySelector('.tooltip.right');
    expect(toolTip).toBeDefined();
  });

  test('bottom property', async () => {
    const { container } = render(CopyButton, {
      content: 'dummy-content',
      bottom: true,
    });

    const toolTip = container.querySelector('.tooltip.bottom');
    expect(toolTip).toBeDefined();
  });

  test('bottomLeft property', async () => {
    const { container } = render(CopyButton, {
      content: 'dummy-content',
      bottomLeft: true,
    });

    const toolTip = container.querySelector('.tooltip.bottom-left');
    expect(toolTip).toBeDefined();
  });

  test('bottomRight property', async () => {
    const { container } = render(CopyButton, {
      content: 'dummy-content',
      bottomLeft: true,
    });

    const toolTip = container.querySelector('.tooltip.bottom-right');
    expect(toolTip).toBeDefined();
  });

  test('left property', async () => {
    const { container } = render(CopyButton, {
      content: 'dummy-content',
      left: true,
    });

    const toolTip = container.querySelector('.tooltip.left');
    expect(toolTip).toBeDefined();
  });
});
