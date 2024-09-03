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

import type { Disposable } from '@podman-desktop/api';
import type { NextFunction, Request, Response } from 'express';
import express from 'express';
import type { Server } from 'node:http';
import path from 'node:path';
import http from 'node:http';
import { existsSync } from 'node:fs';
import * as podmanDesktopApi from '@podman-desktop/api';
import { readFile } from 'node:fs/promises';
import type { ModelsManager } from './modelsManager';
import type { components } from '../../src-generated/openapi';
import type { ModelInfo } from '@shared/src/models/IModelInfo';
import type { ConfigurationRegistry } from '../registries/ConfigurationRegistry';
import { getFreeRandomPort } from '../utils/ports';
import * as OpenApiValidator from 'express-openapi-validator';
import type { HttpError, OpenApiRequest } from 'express-openapi-validator/dist/framework/types';
import type { CatalogManager } from './catalogManager';
import { isProgressEvent } from '../models/baseEvent';

const SHOW_API_INFO_COMMAND = 'ai-lab.show-api-info';
const SHOW_API_ERROR_COMMAND = 'ai-lab.show-api-error';

export const PREFERENCE_RANDOM_PORT = 0;

type ListModelResponse = components['schemas']['ListModelResponse'];

function asListModelResponse(model: ModelInfo): ListModelResponse {
  return {
    model: model.id,
    name: model.name,
    digest: model.sha256,
    size: model.file?.size,
    modified_at: model.file?.creation?.toISOString(),
    details: {},
  };
}

const LISTENING_ADDRESS = '127.0.0.1';

export class ApiServer implements Disposable {
  #listener?: Server;

  constructor(
    private extensionContext: podmanDesktopApi.ExtensionContext,
    private modelsManager: ModelsManager,
    private catalogManager: CatalogManager,
    private configurationRegistry: ConfigurationRegistry,
  ) {}

  protected getListener(): Server | undefined {
    return this.#listener;
  }

  async init(): Promise<void> {
    const app = express();

    // eslint-disable-next-line sonarjs/new-cap
    const router = express.Router();
    router.use(express.json());

    // validate requests / responses based on openapi spec
    router.use(
      OpenApiValidator.middleware({
        apiSpec: this.getSpecFile(),
        validateRequests: true,
        validateResponses: {
          onError: (error, body, req) => {
            console.error(`Response body fails validation: `, error);
            console.error(`Emitted from:`, req.originalUrl);
            console.error(body);
          },
        },
      }),
    );

    router.use((err: HttpError, _req: OpenApiRequest, res: Response, _next: NextFunction) => {
      // format errors from validator
      res.status(err.status || 500).json({
        message: err.message,
        errors: err.errors,
      });
    });

    // declare routes
    router.get('/version', this.getVersion.bind(this));
    router.get('/tags', this.getModels.bind(this));
    router.post('/pull', this.pullModel.bind(this));
    app.get('/', (_res, res) => res.sendStatus(200)); //required for the ollama client to work against us
    app.use('/api', router);
    app.use('/spec', this.getSpec.bind(this));

    const server = http.createServer(app);
    let listeningOn = this.configurationRegistry.getExtensionConfiguration().apiPort;
    server.on('listening', () => {
      this.displayApiInfo(listeningOn);
    });
    server.on('error', () => {
      this.displayApiError(listeningOn);
    });
    if (listeningOn === PREFERENCE_RANDOM_PORT) {
      getFreeRandomPort(LISTENING_ADDRESS)
        .then((randomPort: number) => {
          listeningOn = randomPort;
          this.#listener = server.listen(listeningOn, LISTENING_ADDRESS);
        })
        .catch((e: unknown) => {
          console.error('unable to get a free port for the api server', e);
        });
    } else {
      this.#listener = server.listen(listeningOn, LISTENING_ADDRESS);
    }
  }

  displayApiInfo(port: number): void {
    const apiStatusBarItem = podmanDesktopApi.window.createStatusBarItem();
    apiStatusBarItem.text = `AI Lab API listening on port ${port}`;
    apiStatusBarItem.command = SHOW_API_INFO_COMMAND;
    this.extensionContext.subscriptions.push(
      podmanDesktopApi.commands.registerCommand(SHOW_API_INFO_COMMAND, async () => {
        const address = `http://localhost:${port}`;
        const result = await podmanDesktopApi.window.showInformationMessage(
          `AI Lab API is listening on\n${address}`,
          'OK',
          `Copy`,
        );
        if (result === 'Copy') {
          await podmanDesktopApi.env.clipboard.writeText(address);
        }
      }),
      apiStatusBarItem,
    );
    apiStatusBarItem.show();
  }

  displayApiError(port: number): void {
    const apiStatusBarItem = podmanDesktopApi.window.createStatusBarItem();
    apiStatusBarItem.text = `AI Lab API listening error`;
    apiStatusBarItem.command = SHOW_API_ERROR_COMMAND;
    this.extensionContext.subscriptions.push(
      podmanDesktopApi.commands.registerCommand(SHOW_API_ERROR_COMMAND, async () => {
        const address = `http://localhost:${port}`;
        await podmanDesktopApi.window.showErrorMessage(
          `AI Lab API failed to listen on\n${address}\nYou can change the port in the Preferences then restart the extension.`,
          'OK',
        );
      }),
      apiStatusBarItem,
    );
    apiStatusBarItem.show();
  }

  private getFile(filepath: string): string {
    // when plugin is installed, the file is placed in the plugin directory (~/.local/share/containers/podman-desktop/plugins/<pluginname>/)
    const prodFile = path.join(__dirname, filepath);
    if (existsSync(prodFile)) {
      return prodFile;
    }
    // return dev file
    return path.join(__dirname, '..', '..', filepath);
  }

  getSpecFile(): string {
    return this.getFile('../api/openapi.yaml');
  }

  getPackageFile(): string {
    return this.getFile('../package.json');
  }

  dispose(): void {
    this.#listener?.close();
  }

  private doErr(res: Response, message: string, err: unknown) {
    res.status(500).json({
      message,
      errors: [err instanceof Error ? err.message : err],
    });
  }

  getSpec(_req: Request, res: Response): void {
    try {
      const spec = this.getSpecFile();
      readFile(spec, 'utf-8')
        .then(content => {
          res.status(200).type('application/yaml').send(content);
        })
        .catch((err: unknown) => this.doErr(res, 'unable to get spec', err));
    } catch (err: unknown) {
      this.doErr(res, 'unable to get spec', err);
    }
  }

  getVersion(_req: Request, res: Response): void {
    try {
      const pkg = this.getPackageFile();
      readFile(pkg, 'utf-8')
        .then(content => {
          const json = JSON.parse(content);
          res.status(200).json({ version: `v${json.version}` });
        })
        .catch((err: unknown) => this.doErr(res, 'unable to get version', err));
    } catch (err: unknown) {
      this.doErr(res, 'unable to get version', err);
    }
  }

  getModels(_req: Request, res: Response): void {
    try {
      const models = this.modelsManager
        .getModelsInfo()
        .filter(model => this.modelsManager.isModelOnDisk(model.id))
        .map(model => asListModelResponse(model));
      res.status(200).json({ models: models });
    } catch (err: unknown) {
      this.doErr(res, 'unable to get models', err);
    }
  }

  private streamLine(res: Response, obj: unknown, stream: boolean) {
    if (stream) {
      res.write(JSON.stringify(obj) + '\n');
    }
  }

  private sendResult(res: Response, obj: unknown, code: number, stream: boolean) {
    if (stream) {
      this.streamLine(res, obj, stream);
    } else {
      res.status(code).json(obj);
    }
  }

  pullModel(req: Request, res: Response): void {
    const modelName = req.body['model'] || req.body['name'];
    let stream: boolean = true;
    if ('stream' in req.body) {
      stream = req.body['stream'];
    }
    let modelInfo: ModelInfo;

    this.streamLine(res, { status: 'pulling manifest' }, stream);

    try {
      modelInfo = this.catalogManager.getModelByName(modelName);
    } catch {
      this.sendResult(res, { error: 'pull model manifest: file does not exist' }, 500, stream);
      res.end();
      return;
    }

    if (this.modelsManager.isModelOnDisk(modelInfo.id)) {
      this.sendResult(
        res,
        {
          status: 'success',
        },
        200,
        stream,
      );
      res.end();
      return;
    }

    const abortController = new AbortController();
    const downloader = this.modelsManager.createDownloader(modelInfo, abortController.signal);

    if (stream) {
      downloader.onEvent(event => {
        if (isProgressEvent(event) && event.id === modelName) {
          this.streamLine(
            res,
            {
              status: `pulling ${modelInfo.sha256}`,
              digest: `sha256:${modelInfo.sha256}`,
              total: event.total,
              completed: Math.round((event.total * event.value) / 100),
            },
            stream,
          );
        }
      }, this);
    }

    downloader
      .perform(modelName)
      .then(() => {
        this.sendResult(
          res,
          {
            status: 'success',
          },
          200,
          stream,
        );
      })
      .catch((err: unknown) => {
        this.sendResult(
          res,
          {
            error: String(err),
          },
          500,
          stream,
        );
      })
      .finally(() => {
        res.end();
      });
  }
}
