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
import { ProviderContainerConnection, configuration, env, process, provider } from '@podman-desktop/api';

export type MachineJSON = {
  Name: string;
  CPUs: number;
  Memory: string;
  DiskSize: string;
  Running: boolean;
  Starting: boolean;
  Default: boolean;
  UserModeNetworking?: boolean;
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

async function getJSONMachineList(): Promise<string> {
  const { stdout } = await process.exec(getPodmanCli(), ['machine', 'list', '--format', 'json']);
  return stdout;
}

export async function getFirstRunningPodmanConnection(): Promise<ProviderContainerConnection | undefined> {
  let engine: ProviderContainerConnection;
  try {
    const machineListOutput = await getJSONMachineList();
    const machines = JSON.parse(machineListOutput) as MachineJSON[];
    const machine = machines.find(machine => machine.Default && machine.Running);
    engine = provider
    .getContainerConnections()
    .filter(connection => connection.connection.type === 'podman')
    .find(connection => connection.connection.name === machine.Name);
  } catch(e) {
    console.log(e)
  } 
  
  return engine;
}