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
import { beforeEach, expect, test, vi } from 'vitest';
import { fireEvent, render, within } from '@testing-library/svelte';
import ContainerProviderConnectionSelect from '/@/lib/select/ContainerProviderConnectionSelect.svelte';
import type { ContainerProviderConnectionInfo } from '@shared/src/models/IContainerConnectionInfo';
import { VMType } from '@shared/src/models/IPodman';

beforeEach(() => {
  vi.resetAllMocks();
  // mock scrollIntoView
  window.HTMLElement.prototype.scrollIntoView = vi.fn();
});

const wslConnection: ContainerProviderConnectionInfo = {
  name: 'Machine 1',
  type: 'podman',
  status: 'started',
  providerId: 'podman',
  vmType: VMType.WSL,
};

const qemuConnection: ContainerProviderConnectionInfo = {
  name: 'Machine 2',
  type: 'podman',
  status: 'started',
  providerId: 'podman',
  vmType: VMType.QEMU,
};

test('Should list all container provider connections', async () => {
  const { container } = render(ContainerProviderConnectionSelect, {
    value: undefined,
    containerProviderConnections: [wslConnection, qemuConnection],
  });

  // first get the select input
  const input = within(container).getByLabelText('Select Container Engine');
  await fireEvent.pointerUp(input); // they are using the pointer up event instead of click.

  // get all options available
  const items: NodeListOf<HTMLElement> = container.querySelectorAll('div[class~="list-item"]');
  // ensure we have two options
  expect(items.length).toBe(2);
  expect(items[0]).toHaveTextContent(wslConnection.name);
  expect(items[1]).toHaveTextContent(qemuConnection.name);
});

test('default value should be visible', async () => {
  const { container } = render(ContainerProviderConnectionSelect, {
    value: qemuConnection,
    containerProviderConnections: [wslConnection, qemuConnection],
  });

  // first get the select input
  const select = within(container).getByText(qemuConnection.name);
  expect(select).toBeDefined();
});
