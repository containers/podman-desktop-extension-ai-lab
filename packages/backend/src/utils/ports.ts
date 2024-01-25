/**********************************************************************
 * Copyright (C) 2022 Red Hat, Inc.
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

import * as net from 'net';

/**
 * Find a free port starting from the given port
 */
export async function getFreePort(port = 0): Promise<number> {
  if (port < 1024) {
    port = 9000;
  }
  let isFree = false;
  while (!isFree) {
    isFree = await isFreePort(port);
    if (!isFree) {
      port++;
    }
  }

  return port;
}

/**
 * Find a free port range
 */
export async function getFreePortRange(rangeSize: number): Promise<string> {
  let port = 9000;
  let startPort = port;

  do {
    if (await isFreePort(port)) {
      ++port;
    } else {
      ++port;
      startPort = port;
    }
  } while (port + 1 - startPort <= rangeSize);

  return `${startPort}-${port - 1}`;
}

export function isFreePort(port: number): Promise<boolean> {
  const server = net.createServer();
  return new Promise((resolve, reject) =>
    server
      .on('error', (error: NodeJS.ErrnoException) => (error.code === 'EADDRINUSE' ? resolve(false) : reject(error)))
      .on('listening', () => server.close(() => resolve(true)))
      .listen(port, '127.0.0.1'),
  );
}

export async function getPortsInfo(portDescriptor: string): Promise<string | undefined> {
  // check if portDescriptor is a range of ports
  if (portDescriptor.includes('-')) {
    return await getPortRange(portDescriptor);
  } else {
    const localPort = await getPort(portDescriptor);
    if (!localPort) {
      return undefined;
    }
    return `${localPort}`;
  }
}

/**
 * return a range of the same length as portDescriptor containing free ports
 * undefined if the portDescriptor range is not valid
 * e.g 5000:5001 -> 9000:9001
 */
async function getPortRange(portDescriptor: string): Promise<string | undefined> {
  const rangeValues = getStartEndRange(portDescriptor);
  if (!rangeValues) {
    return Promise.resolve(undefined);
  }

  const rangeSize = rangeValues.endRange + 1 - rangeValues.startRange;
  try {
    // if free port range fails, return undefined
    return await getFreePortRange(rangeSize);
  } catch (e) {
    console.error(e);
    return undefined;
  }
}

async function getPort(portDescriptor: string): Promise<number | undefined> {
  let port: number;
  if (portDescriptor.endsWith('/tcp') || portDescriptor.endsWith('/udp')) {
    port = parseInt(portDescriptor.substring(0, portDescriptor.length - 4));
  } else {
    port = parseInt(portDescriptor);
  }
  // invalid port
  if (isNaN(port)) {
    return Promise.resolve(undefined);
  }
  try {
    // if getFreePort fails, it returns undefined
    return await getFreePort(port);
  } catch (e) {
    console.error(e);
    return undefined;
  }
}

function getStartEndRange(range: string) {
  if (range.endsWith('/tcp') || range.endsWith('/udp')) {
    range = range.substring(0, range.length - 4);
  }

  const rangeValues = range.split('-');
  if (rangeValues.length !== 2) {
    return undefined;
  }
  const startRange = parseInt(rangeValues[0]);
  const endRange = parseInt(rangeValues[1]);

  if (isNaN(startRange) || isNaN(endRange)) {
    return undefined;
  }
  return {
    startRange,
    endRange,
  };
}
