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

import { getLocalModelFile, getRemoteModelFile, MACHINE_BASE_FOLDER } from '../../utils/modelsUtils';
import { WindowsWorker } from '../WindowsWorker';
import { VMType } from '@shared/src/models/IPodman';
import type { UploaderOptions } from './UploaderOptions';
import type { PodmanConnection } from '../../managers/podmanConnection';
import type { ContainerProviderConnection } from '@podman-desktop/api';
import type { ModelInfo } from '@shared/src/models/IModelInfo';

export class WSLUploader extends WindowsWorker<UploaderOptions, string> {
  constructor(private podman: PodmanConnection) {
    super();
  }

  /**
   * @param connection
   * @param model
   * @protected
   */
  protected async isModelUploaded(connection: ContainerProviderConnection, model: ModelInfo): Promise<boolean> {
    const remoteFile = getRemoteModelFile(model);
    try {
      const result = await this.podman.executeSSH(connection, ['stat', remoteFile]);
      return (result.stderr ?? '').length === 0;
    } catch (err: unknown) {
      console.debug(err);
      return false;
    }
  }

  async perform(options: UploaderOptions): Promise<string> {
    const localPath = getLocalModelFile(options.model);

    // ensure the connection type is WSL
    if (options.connection.vmType !== VMType.WSL) {
      console.warn('cannot upload on non-WSL machine');
      return localPath;
    }

    const driveLetter = localPath.charAt(0);
    const convertToMntPath = localPath
      .replace(`${driveLetter}:\\`, `/mnt/${driveLetter.toLowerCase()}/`)
      .replace(/\\/g, '/');

    // check if model already loaded on the podman machine
    const existsRemote = await this.isModelUploaded(options.connection, options.model);

    // get the name of the file on the machine
    const remoteFile = getRemoteModelFile(options.model);

    // if not exists remotely it copies it from the local path
    if (!existsRemote) {
      await this.podman.executeSSH(options.connection, ['mkdir', '-p', MACHINE_BASE_FOLDER]);
      await this.podman.executeSSH(options.connection, ['cp', convertToMntPath, remoteFile]);
    }

    return remoteFile;
  }
}
