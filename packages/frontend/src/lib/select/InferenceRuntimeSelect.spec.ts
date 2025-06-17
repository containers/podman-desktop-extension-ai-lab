/**********************************************************************
 * Copyright (C) 2025 Red Hat, Inc.
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
import { beforeEach, vi, test, expect } from 'vitest';
import { render, fireEvent, within } from '@testing-library/svelte';
import InferenceRuntimeSelect from '/@/lib/select/InferenceRuntimeSelect.svelte';
import { InferenceType } from '@shared/models/IInference';

const getExpectedOptions = (): InferenceType[] => Object.values(InferenceType).filter(t => t !== InferenceType.NONE);

beforeEach(() => {
  // mock scrollIntoView
  window.HTMLElement.prototype.scrollIntoView = vi.fn();
});

test('Lists all runtime options', async () => {
  const { container } = render(InferenceRuntimeSelect, {
    value: undefined,
    disabled: false,
  });

  const input = within(container).getByLabelText('Select Inference Runtime');
  await fireEvent.pointerUp(input);

  const items = container.querySelectorAll('div[class~="list-item"]');
  const expectedOptions = getExpectedOptions();

  expect(items.length).toBe(expectedOptions.length);

  expectedOptions.forEach((option, i) => {
    expect(items[i]).toHaveTextContent(option);
  });
});

test('Selected value should be visible', async () => {
  const { container } = render(InferenceRuntimeSelect, {
    value: undefined,
    disabled: false,
  });

  const input = within(container).getByLabelText('Select Inference Runtime');
  await fireEvent.pointerUp(input);

  const items = container.querySelectorAll('div[class~="list-item"]');
  const expectedOptions = getExpectedOptions();

  await fireEvent.click(items[0]);

  const valueContainer = container.querySelector('.value-container');
  if (!(valueContainer instanceof HTMLElement)) throw new Error('Missing value container');

  const selectedLabel = within(valueContainer).getByText(expectedOptions[0]);
  expect(selectedLabel).toBeDefined();
});

test('Exclude specific runtime from list', async () => {
  const excluded = [InferenceType.WHISPER_CPP, InferenceType.OPENVINO];

  const { container } = render(InferenceRuntimeSelect, {
    value: undefined,
    disabled: false,
    exclude: excluded,
  });

  const input = within(container).getByLabelText('Select Inference Runtime');
  await fireEvent.pointerUp(input);

  const items = container.querySelectorAll('div[class~="list-item"]');
  const itemTexts = Array.from(items).map(item => item.textContent?.trim());

  excluded.forEach(excludedType => {
    expect(itemTexts).not.toContain(excludedType);
  });

  const includedTypes = Object.values(InferenceType).filter(t => t !== InferenceType.NONE && !excluded.includes(t));

  includedTypes.forEach(included => {
    expect(itemTexts).toContain(included);
  });
});
