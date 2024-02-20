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

import path from 'node:path';
import * as podmanDesktopApi from '@podman-desktop/api';
import { getPodmanCli } from '../utils/podman';
import type { UploadWorker } from './uploader';

export class WSLUploader implements UploadWorker {
  canUpload(): boolean {
    return podmanDesktopApi.env.isWindows;
  }

  async upload(localPath: string): Promise<string> {
    if (!localPath) {
      throw new Error('invalid local path');
    }

    const driveLetter = localPath.charAt(0);
    const convertToMntPath = localPath
      .replace(`${driveLetter}:\\`, `/mnt/${driveLetter.toLowerCase()}/`)
      .replace(/\\/g, '/');
    const remotePath = `/home/user/${path.basename(convertToMntPath)}`;
    // check if model already loaded on the podman machine
    let existsRemote = true;
    try {
      await podmanDesktopApi.process.exec(getPodmanCli(), ['machine', 'ssh', 'stat', remotePath]);
    } catch (e) {
      existsRemote = false;
    }

    // if not exists remotely it copies it from the local path
    if (!existsRemote) {
      await podmanDesktopApi.process.exec(getPodmanCli(), ['machine', 'ssh', 'cp', convertToMntPath, remotePath]);
    }

    return remotePath;
  }
}
