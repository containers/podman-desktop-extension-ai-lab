import { test, expect, beforeAll } from 'vitest';
import { RpcBrowser, RpcExtension } from './MessageProxy';
import type { Webview } from '@podman-desktop/api';

let webview: Webview;
let window: Window;
let api: PodmanDesktopApi;

beforeAll(() => {
  let windowListener: (message: unknown) => void;
  let webviewListener: (message: unknown) => void;

  webview = {
    onDidReceiveMessage: (listener: (message: unknown) => void) => {
      webviewListener = listener;
    },
    postMessage: async (message: unknown): Promise<void> => {
      windowListener({ data: message } as MessageEvent);
    },
  } as unknown as Webview;

  window = {
    addEventListener: (channel: string, listener: (message: unknown) => void) => {
      expect(channel).toBe('message');
      windowListener = listener;
    },
  } as unknown as Window;

  api = {
    postMessage: (message: unknown) => {
      webviewListener(message);
    },
  } as unknown as PodmanDesktopApi;
});

test('Test register channel no argument', async () => {
  const rpcExtension = new RpcExtension(webview);
  const rpcBrowser = new RpcBrowser(window, api);

  rpcExtension.register('ping', () => {
    return Promise.resolve('pong');
  });

  expect(await rpcBrowser.invoke('ping')).toBe('pong');
});

test('Test register channel one argument', async () => {
  const rpcExtension = new RpcExtension(webview);
  const rpcBrowser = new RpcBrowser(window, api);

  rpcExtension.register('double', (value: number) => {
    return Promise.resolve(value * 2);
  });

  expect(await rpcBrowser.invoke('double', 4)).toBe(8);
});

test('Test register channel multiple arguments', async () => {
  const rpcExtension = new RpcExtension(webview);
  const rpcBrowser = new RpcBrowser(window, api);

  rpcExtension.register('sum', (...args: number[]) => {
    return Promise.resolve(args.reduce((prev, current) => prev + current, 0));
  });

  expect(await rpcBrowser.invoke('sum', 1, 2, 3, 4, 5)).toBe(15);
});

test('Test register instance with async', async () => {
  class Dummy {
    async ping(): Promise<string> {
      return 'pong';
    }
  }

  const rpcExtension = new RpcExtension(webview);
  const rpcBrowser = new RpcBrowser(window, api);

  rpcExtension.registerInstance(Dummy, new Dummy());

  const proxy = rpcBrowser.getProxy<Dummy>();
  expect(await proxy.ping()).toBe('pong');
});
