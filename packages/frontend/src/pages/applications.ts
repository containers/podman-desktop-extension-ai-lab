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

import type { ApplicationState } from '@shared/src/models/IApplicationState';

/* returns the status of the AI application, to be used by <IconStatus> */
export function getApplicationStatus(appState: ApplicationState): string {
  const podStatus = appState.pod.Status.toUpperCase();
  if (['DEGRADED', 'STARTING', 'USED', 'DELETING', 'CREATED'].includes(podStatus)) {
    return podStatus;
  }
  if (podStatus !== 'RUNNING') {
    return 'UNKNOWN';
  }
  switch (appState.health) {
    case 'none':
    case 'healthy':
      return 'RUNNING';
    case 'starting':
      return 'STARTING';
    case 'unhealthy':
      return 'DEGRADED';
  }
}

/* returns the status of the AI application in plain text */
export function getApplicationStatusText(appState: ApplicationState): string {
  if (appState.pod.Status === 'Running') {
    if (appState.health === 'starting') {
      return 'Starting';
    }
    if (appState.health === 'unhealthy') {
      return 'Degraded';
    }
  }
  return appState.pod.Status;
}
