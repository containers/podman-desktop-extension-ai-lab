import { test, expect, beforeAll } from 'vitest';
import { RpcBrowser, RpcExtension } from './MessageProxy';
import { PodmanDesktopApi } from '../../types/podman-desktop-api';
import type { Webview } from '@podman-desktop/api';

let webview: Webview;
let window: Window;
let api: PodmanDesktopApi;

beforeAll(() => {

  let windowListener: (message: any) => void;
  let webviewListener: (message: any) => void;

  webview = {
    onDidReceiveMessage: (listener: (message: any) => void) => {
      webviewListener = listener;
    },
    postMessage: async (message: any): Promise<void> => {
      windowListener({data: message} as MessageEvent);
    }
  } as unknown as Webview;

  window = {
    addEventListener: (channel: string, listener: (message: any) => void) => {
      expect(channel).toBe('message');
      windowListener = listener;
    },
  } as unknown as Window;

  api = {
    postMessage: (message: any) => {
      webviewListener(message);
    },
  } as unknown as PodmanDesktopApi;
})

test('Test register channel no argument', async () => {
  const rpcExtension = new RpcExtension(webview);
  const rpcBrowser = new RpcBrowser(window, api);

  rpcExtension.register('ping', () => {
    return 'pong';
  });

  expect(await rpcBrowser.invoke('ping')).toBe('pong');
});

test('Test register channel one argument', async () => {
  const rpcExtension = new RpcExtension(webview);
  const rpcBrowser = new RpcBrowser(window, api);

  rpcExtension.register('double', (value: number) => {
    return value*2;
  });

  expect(await rpcBrowser.invoke('double', 4)).toBe(8);
});

test('Test register channel multiple arguments', async () => {
  const rpcExtension = new RpcExtension(webview);
  const rpcBrowser = new RpcBrowser(window, api);

  rpcExtension.register('sum', (...args: number[]) => {
    return args.reduce((prev, current) => prev+current, 0)
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
