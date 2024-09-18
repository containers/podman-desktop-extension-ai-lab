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

import { beforeAll, afterAll, beforeEach, describe, expect, test, vi } from 'vitest';
import { commands, navigation, type WebviewPanel, type Disposable } from '@podman-desktop/api';
import { NavigationRegistry } from './NavigationRegistry';
import { Messages } from '@shared/Messages';

vi.mock('@podman-desktop/api', async () => ({
  commands: {
    registerCommand: vi.fn(),
  },
  navigation: {
    register: vi.fn(),
  },
}));

const panelMock: WebviewPanel = {
  reveal: vi.fn(),
  webview: {
    postMessage: vi.fn(),
  },
} as unknown as WebviewPanel;

beforeEach(() => {
  vi.resetAllMocks();
  vi.restoreAllMocks();
});

describe('incompatible podman-desktop', () => {
  let register: typeof navigation.register | undefined;
  beforeAll(() => {
    register = navigation.register;
    (navigation.register as unknown as undefined) = undefined;
  });

  afterAll(() => {
    if(!register) return;
    navigation.register = register;
  });

  test('init should not register command and navigation when using old version of podman', () => {
    (navigation.register as unknown as undefined) = undefined;
    const registry = new NavigationRegistry(panelMock);
    registry.init();

    expect(commands.registerCommand).not.toHaveBeenCalled();
  });
});

test('init should register command and navigation', () => {
  const registry = new NavigationRegistry(panelMock);
  registry.init();

  expect(commands.registerCommand).toHaveBeenCalled();
  expect(navigation.register).toHaveBeenCalled();
});

test('dispose should dispose all command and navigation registered', () => {
  const registry = new NavigationRegistry(panelMock);
  const disposables: Disposable[] = [];
  vi.mocked(commands.registerCommand).mockImplementation(() => {
    const disposable: Disposable = {
      dispose: vi.fn(),
    };
    disposables.push(disposable);
    return disposable;
  });
  vi.mocked(navigation.register).mockImplementation(() => {
    const disposable: Disposable = {
      dispose: vi.fn(),
    };
    disposables.push(disposable);
    return disposable;
  });

  registry.dispose();

  disposables.forEach((disposable: Disposable) => {
    expect(disposable.dispose).toHaveBeenCalledOnce();
  });
});

test('navigateToInferenceCreate should reveal and postMessage to webview', async () => {
  const registry = new NavigationRegistry(panelMock);

  await registry.navigateToInferenceCreate('dummyTrackingId');

  await vi.waitFor(() => {
    expect(panelMock.reveal).toHaveBeenCalledOnce();
  });

  expect(panelMock.webview.postMessage).toHaveBeenCalledWith({
    id: Messages.MSG_NAVIGATION_ROUTE_UPDATE,
    body: '/service/create?trackingId=dummyTrackingId',
  });
});

test('navigateToRecipeStart should reveal and postMessage to webview', async () => {
  const registry = new NavigationRegistry(panelMock);

  await registry.navigateToRecipeStart('dummyRecipeId', 'dummyTrackingId');

  await vi.waitFor(() => {
    expect(panelMock.reveal).toHaveBeenCalledOnce();
  });

  expect(panelMock.webview.postMessage).toHaveBeenCalledWith({
    id: Messages.MSG_NAVIGATION_ROUTE_UPDATE,
    body: '/recipe/dummyRecipeId/start?trackingId=dummyTrackingId',
  });
});

test('reading the route has side-effect', async () => {
  const registry = new NavigationRegistry(panelMock);

  await registry.navigateToRecipeStart('dummyRecipeId', 'dummyTrackingId');

  expect(registry.readRoute()).toBeDefined();
  expect(registry.readRoute()).toBeUndefined();
});
