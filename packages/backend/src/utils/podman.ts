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
import type { ContainerProviderConnection, ProviderContainerConnection } from '@podman-desktop/api';
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

/**
 * We should be using the {@link @podman-desktop/api#extensions.getExtensions} function to get podman
 * exec method
 * @deprecated
 */
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
 * In the {@link ContainerProviderConnection.name} property the name is not usage, and we need to transform it
 * @param connection
 * @deprecated
 */
export function getPodmanMachineName(connection: ContainerProviderConnection): string {
  const runningConnectionName = connection.name;
  if (runningConnectionName.startsWith('Podman Machine')) {
    const machineName = runningConnectionName.replace(/Podman Machine\s*/, 'podman-machine-');
    if (machineName.endsWith('-')) {
      return `${machineName}default`;
    }
    return machineName;
  } else {
    return runningConnectionName;
  }
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
