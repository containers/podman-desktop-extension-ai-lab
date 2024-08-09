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
import { beforeEach, vi, test, expect } from 'vitest';
import { render, fireEvent, within } from '@testing-library/svelte';
import Select from '/@/lib/select/Select.svelte';

beforeEach(() => {
  // mock scrollIntoView
  window.HTMLElement.prototype.scrollIntoView = vi.fn();
});

test('empty slot should use basic list', async () => {
  const { container} = render(Select, {
    label: 'Select Item',
    items: [{
      label: 'Dummy Item 1',
      value: 'item-1',
    },
      {
        label: 'Dummy Item 2',
        value: 'item-2',
      }],
  });

  // first get the select input
  const input = within(container).getByLabelText('Select Item');
  await fireEvent.pointerUp(input); // they are using the pointer up event instead of click.

  // get all options available
  const items: NodeListOf<HTMLElement> = container.querySelectorAll('div[class~="list-item"]');
  // ensure we have two options
  expect(items.length).toBe(2);
  expect(items[0]).toHaveTextContent('Dummy Item 1');
  expect(items[1]).toHaveTextContent('Dummy Item 2');
});

test('defined value should have corresponding active class to item', async () => {
  const { container} = render(Select, {
    label: 'Select Item',
    items: [{
      label: 'Dummy Item 1',
      value: 'item-1',
    },
      {
        label: 'Dummy Item 2',
        value: 'item-2',
      }],
    value: {
      label: 'Dummy Item 2',
      value: 'item-2',
    },
  });

  // first get the select input
  const input = within(container).getByLabelText('Select Item');
  await fireEvent.pointerUp(input); // they are using the pointer up event instead of click.

  // get all options available
  const items: NodeListOf<HTMLElement> = container.querySelectorAll('div[class~="list-item"]');
  // ensure we have two options
  expect(items.length).toBe(2);
  expect(items[0].children.length).toBe(1);
  expect(items[0].children[0].classList.value).not.toContain('active');
  expect(items[1].children.length).toBe(1);
  expect(items[1].children[0].classList.value).toContain('active');
});

test('selecting value should call onchange callback', async () => {
  const onChangeMock = vi.fn();
  const { container} = render(Select, {
    label: 'Select Item',
    items: [{
      label: 'Dummy Item 1',
      value: 'item-1',
    },
      {
        label: 'Dummy Item 2',
        value: 'item-2',
      }],
    onchange: onChangeMock,
  });

  // first get the select input
  const input = within(container).getByLabelText('Select Item');
  await fireEvent.pointerUp(input); // they are using the pointer up event instead of click.

  // get all options available
  const items: NodeListOf<HTMLElement> = container.querySelectorAll('div[class~="list-item"]');
  // ensure we have two options
  expect(items.length).toBe(2);

  await fireEvent.click(items[1]);

  await vi.waitFor(() => {
    expect(onChangeMock).toHaveBeenCalledWith({
      label: 'Dummy Item 2',
      value: 'item-2',
    });
  });
});
