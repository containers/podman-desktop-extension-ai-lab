import { afterEach, beforeEach, expect, test, vi } from 'vitest';
import { ApiServer } from './apiServer';
import request from 'supertest';
import type * as podmanDesktopApi from '@podman-desktop/api';
import path from 'path';

const extensionContext = {} as unknown as podmanDesktopApi.ExtensionContext;

let server: ApiServer;

beforeEach(async () => {
  server = new ApiServer(extensionContext);
  vi.spyOn(server, 'displayApiInfo').mockReturnValue();
  vi.spyOn(server, 'getSpecFile').mockReturnValue(path.join(__dirname, '../../../../api/openapi.yaml'));
  vi.spyOn(server, 'getPackageFile').mockReturnValue(path.join(__dirname, '../../../../package.json'));
  await server.init();
});

afterEach(() => {
  server.dispose();
});

test('/spec endpoint', async () => {
  expect(server.listener).toBeDefined();
  const res = await request(server.listener!)
    .get('/spec')
    .expect(200)
    .expect('Content-Type', 'application/yaml; charset=utf-8');
  expect(res.text).toMatch(/^openapi:/);
});

test('/spec endpoint when spec file is not found', async () => {
  expect(server.listener).toBeDefined();
  vi.spyOn(server, 'getSpecFile').mockReturnValue(path.join(__dirname, '../../../../api/openapi-notfound.yaml'));
  const res = await request(server.listener!).get('/spec').expect(500);
  expect(res.body.message).toEqual('unable to get spec');
});

test('/spec endpoint when getting spec file fails', async () => {
  expect(server.listener).toBeDefined();
  vi.spyOn(server, 'getSpecFile').mockImplementation(() => {
    throw 'an error getting spec file';
  });
  const res = await request(server.listener!).get('/spec').expect(500);
  expect(res.body.message).toEqual('unable to get spec');
  expect(res.body.errors[0]).toEqual('an error getting spec file');
});

test('/api/version endpoint', async () => {
  expect(server.listener).toBeDefined();
  const res = await request(server.listener!)
    .get('/api/version')
    .expect(200)
    .expect('Content-Type', 'application/json; charset=utf-8');
  expect(res.body.version).toBeDefined();
});

test('/api/version endpoint when package.json file is not found', async () => {
  expect(server.listener).toBeDefined();
  vi.spyOn(server, 'getPackageFile').mockReturnValue(path.join(__dirname, '../../../../package-notfound.json'));
  const res = await request(server.listener!).get('/api/version').expect(500);
  expect(res.body.message).toEqual('unable to get version');
});

test('/api/version endpoint when getting package.json file fails', async () => {
  expect(server.listener).toBeDefined();
  vi.spyOn(server, 'getPackageFile').mockImplementation(() => {
    throw 'an error getting package file';
  });
  const res = await request(server.listener!).get('/api/version').expect(500);
  expect(res.body.message).toEqual('unable to get version');
  expect(res.body.errors[0]).toEqual('an error getting package file');
});

test('/api/version endpoint with unexpected param', async () => {
  expect(server.listener).toBeDefined();
  const res = await request(server.listener!).get('/api/version?wrongParam').expect(400);
  expect(res.body.message).toEqual(`Unknown query parameter 'wrongParam'`);
});

test('/api/wrongEndpoint', async () => {
  expect(server.listener).toBeDefined();
  const res = await request(server.listener!).get('/api/wrongEndpoint').expect(404);
  expect(res.body.message).toEqual('not found');
});
