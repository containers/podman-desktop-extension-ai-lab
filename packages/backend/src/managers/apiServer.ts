import type { Disposable } from '@podman-desktop/api';
import type { NextFunction, Request, Response } from 'express';
import express from 'express';
import type { Server } from 'http';
import * as OpenApiValidator from 'express-openapi-validator';
import type { HttpError, OpenApiRequest } from 'express-openapi-validator/dist/framework/types';
import path from 'node:path';
import http from 'node:http';
import { existsSync, readFileSync } from 'fs';
import { getFreeRandomPort } from '../utils/ports';

const DEFAULT_PORT = 10434;

export class ApiServer implements Disposable {
  #listener?: Server;

  async init(): Promise<void> {
    const app = express();

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
    app.use('/api', router);
    app.use('/spec', this.getSpec.bind(this));

    const server = http.createServer(app);
    server.on('error', () => {
      getFreeRandomPort('0.0.0.0')
        .then((randomPort: number) => {
          console.warn(`port ${DEFAULT_PORT} in use, using ${randomPort} for API server`);
          this.#listener = server.listen(randomPort);
        })
        .catch((e: unknown) => {
          console.error('unable to get a free port for the api server', e);
        });
    });
    this.#listener = server.listen(DEFAULT_PORT);
  }

  getSpecFile(): string {
    // when plugin is installed, the file is placed in the plugin directory (~/.local/share/containers/podman-desktop/plugins/<pluginname>/)
    const prodFile = path.join(__dirname, '../api/openapi.yaml');
    if (existsSync(prodFile)) {
      return prodFile;
    }
    // return dev file
    return path.join(__dirname, '../../../api/openapi.yaml');
  }

  getPackageFile(): string {
    // when plugin is installed, the file is placed in the plugin directory (~/.local/share/containers/podman-desktop/plugins/<pluginname>/)
    const prodFile = path.join(__dirname, '../package.json');
    if (existsSync(prodFile)) {
      return prodFile;
    }
    // return dev file
    return path.join(__dirname, '../../../package.json');
  }

  dispose(): void {
    this.#listener?.close();
  }

  getSpec(_req: Request, res: Response): void {
    try {
      const spec = this.getSpecFile();
      const content = readFileSync(spec, 'utf-8');
      res.status(200).type('application/yaml').send(content);
    } catch (err: unknown) {
      res.status(500).json({
        message: 'unable to get spec',
        errors: [err],
      });
    }
  }

  getVersion(_req: Request, res: Response): void {
    try {
      const pkg = this.getPackageFile();
      const content = readFileSync(pkg, 'utf-8');
      const json = JSON.parse(content);
      res.status(200).json({ version: `v${json.version}` });
    } catch (err: unknown) {
      res.status(500).json({
        message: 'unable to get version',
        errors: [err],
      });
    }
  }
}
