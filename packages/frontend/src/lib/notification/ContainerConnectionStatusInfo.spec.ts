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
import { render, screen } from '@testing-library/svelte';
import ContainerConnectionStatusInfo from './ContainerConnectionStatusInfo.svelte';
import type { ContainerConnectionInfo } from '@shared/src/models/IContainerConnectionInfo';
import { studioClient } from '/@/utils/client';
import { filesize } from 'filesize';
import userEvent from '@testing-library/user-event';

vi.mock('/@/utils/client', async () => {
  return {
    studioClient: {
      navigateToResources: vi.fn(),
      navigateToEditConnectionProvider: vi.fn(),
    },
  };
});

beforeEach(() => {
  vi.resetAllMocks();
});

test('should not show anything if there is no title or description', async () => {
  const connectionInfo: ContainerConnectionInfo = {
    name: 'Podman machine',
    status: 'running',
    canRedirect: true,
  };
  render(ContainerConnectionStatusInfo, { connectionInfo });

  const banner = screen.queryByLabelText('Container connection info banner');
  expect(banner).not.toBeInTheDocument();
});

test('should show no running machine banner if there is no running machine', async () => {
  const navigateMock = vi.spyOn(studioClient, 'navigateToResources');
  const noMachineInfo: ContainerConnectionInfo = {
    status: 'no-machine',
    canRedirect: true,
  };

  render(ContainerConnectionStatusInfo, { connectionInfo: noMachineInfo });

  const banner = screen.getByLabelText('Container connection info banner');
  expect(banner).toBeInTheDocument();
  const titleDiv = screen.getByLabelText('title');
  expect(titleDiv).toBeInTheDocument();
  expect(titleDiv.textContent).equals('No Podman machine is running');
  const descriptionDiv = screen.getByLabelText('description');
  expect(descriptionDiv).toBeInTheDocument();
  expect(descriptionDiv.textContent).equals('Please start a Podman Machine before proceeding further.');

  const btnStart = screen.getByRole('button', { name: 'Start now' });
  expect(btnStart).toBeInTheDocument();

  await userEvent.click(btnStart);

  expect(navigateMock).toBeCalled();
});

test('should show no running machine banner if there is no running machine and no action if canRedirect is disabled', async () => {
  const noMachineInfo: ContainerConnectionInfo = {
    status: 'no-machine',
    canRedirect: false,
  };

  render(ContainerConnectionStatusInfo, { connectionInfo: noMachineInfo });

  const banner = screen.getByLabelText('Container connection info banner');
  expect(banner).toBeInTheDocument();
  const titleDiv = screen.getByLabelText('title');
  expect(titleDiv).toBeInTheDocument();
  expect(titleDiv.textContent).equals('No Podman machine is running');
  const descriptionDiv = screen.getByLabelText('description');
  expect(descriptionDiv).toBeInTheDocument();
  expect(descriptionDiv.textContent).equals('Please start a Podman Machine before proceeding further.');

  const btnStart = screen.queryByRole('button', { name: 'Start now' });
  expect(btnStart).not.toBeInTheDocument();
});

test('should show lowResourcesMachine banner if the running machine has not enough resources and both canEdit and canRedirect are true', async () => {
  const navigateMock = vi.spyOn(studioClient, 'navigateToEditConnectionProvider');
  const connectionInfo: ContainerConnectionInfo = {
    name: 'Podman Machine',
    canEdit: true,
    canRedirect: true,
    cpus: 4,
    cpusExpected: 10,
    memoryExpected: 10,
    memoryIdle: 5,
    status: 'low-resources',
  };

  render(ContainerConnectionStatusInfo, { connectionInfo });

  const banner = screen.getByLabelText('Container connection info banner');
  expect(banner).toBeInTheDocument();
  const titleDiv = screen.getByLabelText('title');
  expect(titleDiv).toBeInTheDocument();
  expect(titleDiv.textContent).equals('Upgrade your Podman machine for best AI performance');
  const descriptionDiv = screen.getByLabelText('description');
  expect(descriptionDiv).toBeInTheDocument();
  expect(descriptionDiv.textContent).equals(
    `Your Podman Machine has ${connectionInfo.cpus} vCPUs and ${filesize(connectionInfo.memoryIdle, { base: 2 })} of memory available. We recommend upgrading your Podman machine with at least ${connectionInfo.cpusExpected} vCPUs and ${filesize(connectionInfo.memoryExpected, { base: 2 })} of memory for better AI performance.`,
  );

  const btnUpgrade = screen.getByRole('button', { name: 'Upgrade now' });
  expect(btnUpgrade).toBeInTheDocument();

  await userEvent.click(btnUpgrade);

  expect(navigateMock).toBeCalledWith('Podman Machine');
});

test('should show lowResourcesMachine banner if the running machine has not enough cpus and both canEdit and canRedirect are true', async () => {
  const navigateMock = vi.spyOn(studioClient, 'navigateToEditConnectionProvider');
  const connectionInfo: ContainerConnectionInfo = {
    name: 'Podman Machine',
    canEdit: true,
    canRedirect: true,
    cpus: 4,
    cpusExpected: 10,
    memoryExpected: 4,
    memoryIdle: 5,
    status: 'low-resources',
  };

  render(ContainerConnectionStatusInfo, { connectionInfo });

  const banner = screen.getByLabelText('Container connection info banner');
  expect(banner).toBeInTheDocument();
  const titleDiv = screen.getByLabelText('title');
  expect(titleDiv).toBeInTheDocument();
  expect(titleDiv.textContent).equals('Upgrade your Podman machine for best AI performance');
  const descriptionDiv = screen.getByLabelText('description');
  expect(descriptionDiv).toBeInTheDocument();
  expect(descriptionDiv.textContent).equals(
    `Your Podman Machine has ${connectionInfo.cpus} vCPUs. We recommend upgrading your Podman machine with at least ${connectionInfo.cpusExpected} vCPUs for better AI performance.`,
  );

  const btnUpgrade = screen.getByRole('button', { name: 'Upgrade now' });
  expect(btnUpgrade).toBeInTheDocument();

  await userEvent.click(btnUpgrade);

  expect(navigateMock).toBeCalledWith('Podman Machine');
});

test('should show lowResourcesMachine banner if the running machine has not enough memory and both canEdit and canRedirect are true', async () => {
  const navigateMock = vi.spyOn(studioClient, 'navigateToEditConnectionProvider');
  const connectionInfo: ContainerConnectionInfo = {
    name: 'Podman Machine',
    canEdit: true,
    canRedirect: true,
    cpus: 12,
    cpusExpected: 10,
    memoryExpected: 10,
    memoryIdle: 5,
    status: 'low-resources',
  };

  render(ContainerConnectionStatusInfo, { connectionInfo });

  const banner = screen.getByLabelText('Container connection info banner');
  expect(banner).toBeInTheDocument();
  const titleDiv = screen.getByLabelText('title');
  expect(titleDiv).toBeInTheDocument();
  expect(titleDiv.textContent).equals('Upgrade your Podman machine for best AI performance');
  const descriptionDiv = screen.getByLabelText('description');
  expect(descriptionDiv).toBeInTheDocument();
  expect(descriptionDiv.textContent).equals(
    `Your Podman Machine has ${filesize(connectionInfo.memoryIdle, { base: 2 })} of memory available. We recommend upgrading your Podman machine with at least ${filesize(connectionInfo.memoryExpected, { base: 2 })} of memory for better AI performance.`,
  );

  const btnUpgrade = screen.getByRole('button', { name: 'Upgrade now' });
  expect(btnUpgrade).toBeInTheDocument();

  await userEvent.click(btnUpgrade);

  expect(navigateMock).toBeCalledWith('Podman Machine');
});

test('should show lowResourcesMachine banner without action if the running machine has not enough resources but canEdit is false', async () => {
  const connectionInfo: ContainerConnectionInfo = {
    name: 'Podman Machine',
    canEdit: false,
    canRedirect: true,
    cpus: 4,
    cpusExpected: 10,
    memoryExpected: 10,
    memoryIdle: 5,
    status: 'low-resources',
  };

  render(ContainerConnectionStatusInfo, { connectionInfo });

  const banner = screen.getByLabelText('Container connection info banner');
  expect(banner).toBeInTheDocument();
  const titleDiv = screen.getByLabelText('title');
  expect(titleDiv).toBeInTheDocument();
  expect(titleDiv.textContent).equals('Upgrade your Podman machine for best AI performance');
  const descriptionDiv = screen.getByLabelText('description');
  expect(descriptionDiv).toBeInTheDocument();
  expect(descriptionDiv.textContent).equals(
    `Your Podman Machine has ${connectionInfo.cpus} vCPUs and ${filesize(connectionInfo.memoryIdle, { base: 2 })} of memory available. We recommend freeing some resources on your Podman machine to have at least ${connectionInfo.cpusExpected} vCPUs and ${filesize(connectionInfo.memoryExpected, { base: 2 })} of memory for better AI performance.`,
  );

  const btnUpgrade = screen.queryByRole('button', { name: 'Upgrade now' });
  expect(btnUpgrade).not.toBeInTheDocument();
});

test('should show lowResourcesMachine banner without action if the running machine has not enough resources but canRedirect is false', async () => {
  const connectionInfo: ContainerConnectionInfo = {
    name: 'Podman Machine',
    canEdit: true,
    canRedirect: false,
    cpus: 4,
    cpusExpected: 10,
    memoryExpected: 10,
    memoryIdle: 5,
    status: 'low-resources',
  };

  render(ContainerConnectionStatusInfo, { connectionInfo });

  const banner = screen.getByLabelText('Container connection info banner');
  expect(banner).toBeInTheDocument();
  const titleDiv = screen.getByLabelText('title');
  expect(titleDiv).toBeInTheDocument();
  expect(titleDiv.textContent).equals('Upgrade your Podman machine for best AI performance');
  const descriptionDiv = screen.getByLabelText('description');
  expect(descriptionDiv).toBeInTheDocument();
  expect(descriptionDiv.textContent).equals(
    `Your Podman Machine has ${connectionInfo.cpus} vCPUs and ${filesize(connectionInfo.memoryIdle, { base: 2 })} of memory available. We recommend upgrading your Podman machine with at least ${connectionInfo.cpusExpected} vCPUs and ${filesize(connectionInfo.memoryExpected, { base: 2 })} of memory for better AI performance.`,
  );

  const btnUpgrade = screen.queryByRole('button', { name: 'Upgrade now' });
  expect(btnUpgrade).not.toBeInTheDocument();
});
