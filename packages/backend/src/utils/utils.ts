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
import * as http from 'node:http';

export async function timeout(time: number): Promise<void> {
  return new Promise<void>(resolve => {
    setTimeout(resolve, time);
  });
}

export async function isEndpointAlive(endPoint: string): Promise<boolean> {
  return new Promise<boolean>(resolve => {
    const req = http.get(endPoint, res => {
      res.on('data', () => {
        // do nothing
      });

      res.on('end', () => {
        console.log(res);
        if (res.statusCode === 200) {
          resolve(true);
        } else {
          resolve(false);
        }
      });
    });
    req.once('error', err => {
      console.log('Error while pinging endpoint', err);
      resolve(false);
    });
  });
}

export function getDurationSecondsSince(startTimeMs: number) {
  return Math.round((performance.now() - startTimeMs) / 1000);
}

export const DISABLE_SELINUX_LABEL_SECURITY_OPTION = 'label=disable';
