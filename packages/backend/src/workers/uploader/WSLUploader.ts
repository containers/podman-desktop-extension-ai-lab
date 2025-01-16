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
import { getPodmanCli, getPodmanMachineName } from '../../utils/podman';
import { getLocalModelFile, getRemoteModelFile, isModelUploaded, MACHINE_BASE_FOLDER } from '../../utils/modelsUtils';
import { WindowsWorker } from '../WindowsWorker';
import { VMType } from '@shared/src/models/IPodman';
import type { UploaderOptions } from './UploaderOptions';
import { escapeSpaces } from '../../utils/pathUtils';

export class WSLUploader extends WindowsWorker<UploaderOptions, string> {
  async perform(options: UploaderOptions): Promise<string> {
    const localPath = getLocalModelFile(options.model);

    // ensure the connection type is WSL
    if (options.connection.vmType !== VMType.WSL) {
      console.warn('cannot upload on non-WSL machine');
      return localPath;
    }

    // the connection name cannot be used as it is
    const machineName = getPodmanMachineName(options.connection);

    const driveLetter = localPath.charAt(0);
    const convertToMntPath = escapeSpaces(
      localPath.replace(`${driveLetter}:\\`, `/mnt/${driveLetter.toLowerCase()}/`).replace(/\\/g, '/'),
    );

    // check if model already loaded on the podman machine
    const existsRemote = await isModelUploaded(machineName, options.model);
    const remoteFile = escapeSpaces(getRemoteModelFile(options.model));

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
