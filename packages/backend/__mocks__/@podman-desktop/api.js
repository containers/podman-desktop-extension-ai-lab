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

import { vi } from 'vitest';

const mockFunction = () => vi.fn();

export const containerEngine = {
  buildImage: mockFunction(),
  createContainer: mockFunction(),
  createPod: mockFunction(),
  deleteContainer: mockFunction(),
  info: mockFunction(),
  inspectContainer: mockFunction(),
  listContainers: mockFunction(),
  listImages: mockFunction(),
  listInfos: mockFunction(),
  listPods: mockFunction(),
  onEvent: mockFunction(),
  pullImage: mockFunction(),
  removePod: mockFunction(),
  startContainer: mockFunction(),
  startPod: mockFunction(),
  statsContainer: mockFunction(),
  stopContainer: mockFunction(),
  stopPod: mockFunction(),
};

export const configuration = {
  get: mockFunction(),
  getConfiguration: vi.fn(() => ({ get: mockFunction(), has: mockFunction(), update: mockFunction() })),
  onDidChangeConfiguration: mockFunction(),
  update: mockFunction(),
};

export const commands = { registerCommand: mockFunction() };
export const navigation = {
  inference: mockFunction(),
  navigateToContainer: mockFunction(),
  navigateToContainerTerminal: mockFunction(),
  navigateToEditProviderContainerConnection: mockFunction(),
  navigateToPod: mockFunction(),
  navigateToResources: mockFunction(),
  recipe: mockFunction(),
  register: mockFunction(),
};
export const provider = {
  getContainerConnections: mockFunction(),
  onDidRegisterContainerConnection: mockFunction(),
  onDidUnregisterContainerConnection: mockFunction(),
  onDidUpdateContainerConnection: mockFunction(),
  onDidUpdateProvider: mockFunction(),
  perform: mockFunction(),
};
export const extensions = { getExtension: mockFunction() };
export const process = { exec: mockFunction() };
export const env = {
  clipboard: { readText: mockFunction(), writeText: mockFunction() },
  createTelemetryLogger: vi.fn(() => ({ logError: mockFunction(), logUsage: mockFunction() })),
  isLinux: false,
  isWindows: false,
  openExternal: mockFunction(),
};
export const window = {
  createStatusBarItem: vi.fn(() => ({ show: mockFunction(), hide: mockFunction(), dispose: mockFunction() })),
  createWebviewPanel: vi.fn(() => ({
    onDidChangeViewState: mockFunction(),
    webview: {
      asWebviewUri: mockFunction(),
      html: '',
      onDidReceiveMessage: mockFunction(),
      postMessage: mockFunction(),
    },
  })),
  showErrorMessage: mockFunction(),
  showNotification: mockFunction(),
  showOpenDialog: mockFunction(),
  showWarningMessage: mockFunction(),
  withProgress: mockFunction(),
};
export const fs = {
  createFileSystemWatcher: vi.fn(() => ({
    onDidChange: mockFunction(),
    onDidCreate: mockFunction(),
    onDidDelete: mockFunction(),
  })),
  existsSync: mockFunction(),
  mkdir: mockFunction(),
  readFileSync: mockFunction(),
  rm: mockFunction(),
  createReadStream: mockFunction(),
  promises: {
    access: mockFunction(),
    mkdir: mockFunction(),
    readFile: mockFunction(),
    readdir: mockFunction(),
    rm: mockFunction(),
    stat: mockFunction(),
    writeFile: mockFunction(),
  },
};
export const Disposable = {
  create: mockFunction(),
  from: mockFunction(),
};
export const EventEmitter = vi.fn(() => ({ fire: mockFunction(), event: mockFunction() }));
export const CancellationTokenSource = vi.fn();
export const ProgressLocation = { TASK_WIDGET: 'TASK_WIDGET' };
export const version = '0.0.0-test';
export const Uri = {
  file: vi.fn(path => ({ fsPath: path, path })),
  joinPath: vi.fn((base, ...parts) => ({ fsPath: [base?.fsPath, ...parts].filter(Boolean).join('/') })),
  parse: vi.fn(value => ({ fsPath: value, path: value })),
};

const api = {
  CancellationTokenSource,
  Disposable,
  EventEmitter,
  ProgressLocation,
  Uri,
  version,
  commands,
  configuration,
  containerEngine,
  env,
  extensions,
  fs,
  navigation,
  process,
  provider,
  window,
};

export default api;
