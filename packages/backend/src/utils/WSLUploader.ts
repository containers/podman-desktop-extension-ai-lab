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

import * as podmanDesktopApi from '@podman-desktop/api';
import { getFirstRunningMachineName, getPodmanCli } from './podman';
import type { UploadWorker } from './uploader';
import { getLocalModelFile, getRemoteModelFile, isModelUploaded, MACHINE_BASE_FOLDER } from './modelsUtils';
import type { ModelInfo } from '@shared/src/models/IModelInfo';

export class WSLUploader implements UploadWorker {
  canUpload(): boolean {
    return podmanDesktopApi.env.isWindows;
  }

  async upload(modelInfo: ModelInfo): Promise<string> {
    const localPath = getLocalModelFile(modelInfo);

    const driveLetter = localPath.charAt(0);
    const convertToMntPath = localPath
      .replace(`${driveLetter}:\\`, `/mnt/${driveLetter.toLowerCase()}/`)
      .replace(/\\/g, '/');

    const machineName = getFirstRunningMachineName();

    if (!machineName) {
      throw new Error('No podman machine is running');
    }
    // check if model already loaded on the podman machine
    const existsRemote = await isModelUploaded(machineName, modelInfo);
    const remoteFile = getRemoteModelFile(modelInfo);

    // if not exists remotely it copies it from the local path
    if (!existsRemote) {
      await podmanDesktopApi.process.exec(getPodmanCli(), [
        'machine',
        'ssh',
        machineName,
        'mkdir',
        '-p',
        MACHINE_BASE_FOLDER,
      ]);
      await podmanDesktopApi.process.exec(getPodmanCli(), [
        'machine',
        'ssh',
        machineName,
        'cp',
        convertToMntPath,
        remoteFile,
      ]);
    }

    return remoteFile;
  }
}
