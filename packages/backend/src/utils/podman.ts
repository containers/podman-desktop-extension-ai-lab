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
import type { ProviderContainerConnection } from '@podman-desktop/api';
import { configuration, env, provider } from '@podman-desktop/api';

export const MIN_CPUS_VALUE = 4;

export type MachineJSON = {
  Name: string;
  CPUs: number;
  Memory: string;
  DiskSize: string;
  Running: boolean;
  Starting: boolean;
  Default: boolean;
  UserModeNetworking?: boolean;
  VMType?: string;
};

export function getPodmanCli(): string {
  // If we have a custom binary path regardless if we are running Windows or not
  const customBinaryPath = getCustomBinaryPath();
  if (customBinaryPath) {
    return customBinaryPath;
  }

  if (env.isWindows) {
    return 'podman.exe';
  }
  return 'podman';
}

// Get the Podman binary path from configuration podman.binary.path
// return string or undefined
export function getCustomBinaryPath(): string | undefined {
  return configuration.getConfiguration('podman').get('binary.path');
}

/**
 * @deprecated uses {@link PodmanConnection.findRunningContainerProviderConnection}
 */
export function getFirstRunningMachineName(): string | undefined {
  // the name of the podman connection is the name of the podman machine updated to make it more user friendly,
  // so to retrieve the real machine name we need to revert the process

  // podman-machine-default -> Podman Machine
  // podman-machine-{name} -> Podman Machine {name}
  // {name} -> {name}
  try {
    const runningConnection = getFirstRunningPodmanConnection();
    if (!runningConnection) return undefined;
    const runningConnectionName = runningConnection.connection.name;
    if (runningConnectionName.startsWith('Podman Machine')) {
      const machineName = runningConnectionName.replace(/Podman Machine\s*/, 'podman-machine-');
      if (machineName.endsWith('-')) {
        return `${machineName}default`;
      }
      return machineName;
    } else {
      return runningConnectionName;
    }
  } catch (e) {
    console.log(e);
  }

  return undefined;
}

/**
 * @deprecated uses {@link PodmanConnection.findRunningContainerProviderConnection}
 */
export function getFirstRunningPodmanConnection(): ProviderContainerConnection | undefined {
  let engine: ProviderContainerConnection | undefined = undefined;
  try {
    engine = provider
      .getContainerConnections()
      .filter(connection => connection.connection.type === 'podman')
      .find(connection => connection.connection.status() === 'started');
  } catch (e) {
    console.log(e);
  }
  return engine;
}

/**
 * @deprecated uses {@link PodmanConnection.getContainerProviderConnection}
 */
export function getPodmanConnection(connectionName: string): ProviderContainerConnection {
  const engine = provider
    .getContainerConnections()
    .filter(connection => connection.connection.type === 'podman')
    .find(connection => connection.connection.name === connectionName);
  if (!engine) {
    throw new Error(`no podman connection found with name ${connectionName}`);
  }
  return engine;
}
