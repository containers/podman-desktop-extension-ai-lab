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

import { afterEach, beforeEach, expect, test, vi } from 'vitest';
import { ApiServer, PREFERENCE_RANDOM_PORT } from './apiServer';
import request from 'supertest';
import type * as podmanDesktopApi from '@podman-desktop/api';
import path from 'path';
import type { Server } from 'http';
import type { ModelsManager } from './modelsManager';
import type { EventEmitter } from 'node:events';
import { once } from 'node:events';
import type { ConfigurationRegistry } from '../registries/ConfigurationRegistry';
import type { AddressInfo } from 'node:net';
import type { CatalogManager } from './catalogManager';
import type { Downloader } from '../utils/downloader';
import type { ProgressEvent } from '../models/baseEvent';

class TestApiServer extends ApiServer {
  public override getListener(): Server | undefined {
    return super.getListener();
  }
}

const extensionContext = {} as unknown as podmanDesktopApi.ExtensionContext;

let server: TestApiServer;

const modelsManager = {
  getModelsInfo: vi.fn(),
  isModelOnDisk: vi.fn(),
  createDownloader: vi.fn(),
} as unknown as ModelsManager;
const catalogManager = {
  getModelByName: vi.fn(),
} as unknown as CatalogManager;
const configurationRegistry = {
  getExtensionConfiguration: () => {
    return {
      apiPort: PREFERENCE_RANDOM_PORT,
    };
  },
} as unknown as ConfigurationRegistry;
beforeEach(async () => {
  vi.clearAllMocks();
  server = new TestApiServer(extensionContext, modelsManager, catalogManager, configurationRegistry);
  vi.spyOn(server, 'displayApiInfo').mockReturnValue();
  vi.spyOn(server, 'getSpecFile').mockReturnValue(path.join(__dirname, '../../../../api/openapi.yaml'));
  vi.spyOn(server, 'getPackageFile').mockReturnValue(path.join(__dirname, '../../../../package.json'));
  await server.init();
  await new Promise(resolve => setTimeout(resolve, 0)); // wait for random port to be set
});

afterEach(async () => {
  server.dispose();
  await once(server.getListener() as EventEmitter, 'close');
});

test('/spec endpoint', async () => {
  expect(server.getListener()).toBeDefined();
  const res = await request(server.getListener()!)
    .get('/spec')
    .expect(200)
    .expect('Content-Type', 'application/yaml; charset=utf-8');
  expect(res.text).toMatch(/^openapi:/);
});

test('/spec endpoint when spec file is not found', async () => {
  expect(server.getListener()).toBeDefined();
  vi.spyOn(server, 'getSpecFile').mockReturnValue(path.join(__dirname, '../../../../api/openapi-notfound.yaml'));
  const res = await request(server.getListener()!).get('/spec').expect(500);
  expect(res.body.message).toEqual('unable to get spec');
});

test('/spec endpoint when getting spec file fails', async () => {
  expect(server.getListener()).toBeDefined();
  vi.spyOn(server, 'getSpecFile').mockImplementation(() => {
    throw new Error('an error getting spec file');
  });
  const res = await request(server.getListener()!).get('/spec').expect(500);
  expect(res.body.message).toEqual('unable to get spec');
  expect(res.body.errors[0]).toEqual('an error getting spec file');
});

test('/api/version endpoint', async () => {
  expect(server.getListener()).toBeDefined();
  const res = await request(server.getListener()!)
    .get('/api/version')
    .expect(200)
    .expect('Content-Type', 'application/json; charset=utf-8');
  expect(res.body.version).toBeDefined();
});

test('/api/version endpoint when package.json file is not found', async () => {
  expect(server.getListener()).toBeDefined();
  vi.spyOn(server, 'getPackageFile').mockReturnValue(path.join(__dirname, '../../../../package-notfound.json'));
  const res = await request(server.getListener()!).get('/api/version').expect(500);
  expect(res.body.message).toEqual('unable to get version');
});

test('/api/version endpoint when getting package.json file fails', async () => {
  expect(server.getListener()).toBeDefined();
  vi.spyOn(server, 'getPackageFile').mockImplementation(() => {
    throw new Error('an error getting package file');
  });
  const res = await request(server.getListener()!).get('/api/version').expect(500);
  expect(res.body.message).toEqual('unable to get version');
  expect(res.body.errors[0]).toEqual('an error getting package file');
});

test('/api/version endpoint with unexpected param', async () => {
  expect(server.getListener()).toBeDefined();
  const res = await request(server.getListener()!).get('/api/version?wrongParam').expect(400);
  expect(res.body.message).toEqual(`Unknown query parameter 'wrongParam'`);
});

test('/api/wrongEndpoint', async () => {
  expect(server.getListener()).toBeDefined();
  const res = await request(server.getListener()!).get('/api/wrongEndpoint').expect(404);
  expect(res.body.message).toEqual('not found');
});

test('/', async () => {
  expect(server.getListener()).toBeDefined();
  await request(server.getListener()!).get('/').expect(200);
});

test('/api/tags', async () => {
  expect(server.getListener()).toBeDefined();
  vi.mocked(modelsManager.getModelsInfo).mockReturnValue([]);
  await request(server.getListener()!).get('/api/tags').expect(200);
});

test('/api/tags returns error', async () => {
  expect(server.getListener()).toBeDefined();
  vi.mocked(modelsManager.getModelsInfo).mockRejectedValue({});
  const res = await request(server.getListener()!).get('/api/tags').expect(500);
  expect(res.body.message).toEqual('unable to get models');
});

test('verify listening on localhost', async () => {
  expect(server.getListener()).toBeDefined();
  expect((server.getListener()?.address() as AddressInfo).address).toEqual('127.0.0.1');
});

test('/api/pull returns an error if no body is passed', async () => {
  expect(server.getListener()).toBeDefined();
  await request(server.getListener()!).post('/api/pull').expect(415);
});

test('/api/pull returns an error if the model is not known', async () => {
  expect(server.getListener()).toBeDefined();
  vi.mocked(catalogManager.getModelByName).mockImplementation(() => {
    throw new Error('model unknown');
  });
  const res = await request(server.getListener()!).post('/api/pull').send({ model: 'unknown-model-name' }).expect(200);
  const lines = res.text.split('\n');
  expect(lines.length).toEqual(3);
  expect(lines[0]).toEqual('{"status":"pulling manifest"}');
  expect(lines[1]).toEqual('{"error":"pull model manifest: file does not exist"}');
  expect(lines[2]).toEqual('');
});

test('/api/pull returns success if model already downloaded', async () => {
  expect(server.getListener()).toBeDefined();
  vi.mocked(catalogManager.getModelByName).mockReturnValue({
    id: 'modelId',
    name: 'model-name',
    description: 'a description',
  });
  vi.mocked(modelsManager.isModelOnDisk).mockReturnValue(true);
  const res = await request(server.getListener()!).post('/api/pull').send({ model: 'model-name' }).expect(200);
  const lines = res.text.split('\n');
  expect(lines.length).toEqual(3);
  expect(lines[0]).toEqual('{"status":"pulling manifest"}');
  expect(lines[1]).toEqual('{"status":"success"}');
  expect(lines[2]).toEqual('');
});

test('/api/pull downloads model and returns success', async () => {
  expect(server.getListener()).toBeDefined();
  vi.mocked(catalogManager.getModelByName).mockReturnValue({
    id: 'modelId',
    name: 'model-name',
    description: 'a description',
    sha256: '123456',
  });
  vi.mocked(modelsManager.isModelOnDisk).mockReturnValue(false);
  vi.mocked(modelsManager.createDownloader).mockReturnValue({
    perform: async (_name: string) => {},
    onEvent: (listener: (e: ProgressEvent) => void) => {
      listener({
        status: 'progress',
        id: 'model-name',
        total: 100000,
        value: 100000,
      });
    },
  } as unknown as Downloader);
  const res = await request(server.getListener()!).post('/api/pull').send({ model: 'model-name' }).expect(200);
  const lines = res.text.split('\n');
  expect(lines.length).toEqual(4);
  expect(lines[0]).toEqual('{"status":"pulling manifest"}');
  expect(lines[1]).toEqual('{"status":"pulling 123456","digest":"sha256:123456","total":100000,"completed":100000000}');
  expect(lines[2]).toEqual('{"status":"success"}');
  expect(lines[3]).toEqual('');
});

test('/api/pull should return an error if an error occurs during download', async () => {
  expect(server.getListener()).toBeDefined();
  vi.mocked(catalogManager.getModelByName).mockReturnValue({
    id: 'modelId',
    name: 'model-name',
    description: 'a description',
    sha256: '123456',
  });
  vi.mocked(modelsManager.isModelOnDisk).mockReturnValue(false);
  vi.mocked(modelsManager.createDownloader).mockReturnValue({
    perform: async (_name: string) => {
      await new Promise(resolve => setTimeout(resolve, 0)); // wait for random port to be set
      throw new Error('an error');
    },
    onEvent: (listener: (e: ProgressEvent) => void) => {
      listener({
        status: 'progress',
        id: 'model-name',
        total: 100000,
        value: 100000,
      });
    },
  } as unknown as Downloader);
  const res = await request(server.getListener()!).post('/api/pull').send({ model: 'model-name' }).expect(200);
  const lines = res.text.split('\n');
  expect(lines.length).toEqual(4);
  expect(lines[0]).toEqual('{"status":"pulling manifest"}');
  expect(lines[1]).toEqual('{"status":"pulling 123456","digest":"sha256:123456","total":100000,"completed":100000000}');
  expect(lines[2]).toEqual('{"error":"Error: an error"}');
  expect(lines[3]).toEqual('');
});
