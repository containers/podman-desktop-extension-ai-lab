/**********************************************************************
 * Copyright (C) 2024-2025 Red Hat, Inc.
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

import { test, expect, vi, describe, beforeEach, afterEach } from 'vitest';
import { createRpcChannel, RpcBrowser, RpcExtension } from './MessageProxy';
import type { Webview } from '@podman-desktop/api';

let webview: Webview;
let window: Window;
let api: PodmanDesktopApi;

const originalConsoleError = console.error;

beforeEach(() => {
  let windowListener: (message: unknown) => void;
  let webviewListener: (message: unknown) => void;
  console.error = vi.fn();

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

afterEach(() => {
  console.error = originalConsoleError;
});

test('init logic should be executing once', () => {
  vi.spyOn(webview, 'onDidReceiveMessage');
  const rpcExtension = new RpcExtension(webview);
  rpcExtension.init();

  expect(webview.onDidReceiveMessage).toHaveBeenCalledOnce();
});

test('Test register channel with method without argument', async () => {
  const rpcExtension = new RpcExtension(webview);
  rpcExtension.init();
  const rpcBrowser = new RpcBrowser(window, api);

  type Ping = {
    ping: () => Promise<string>;
  };

  const channel = createRpcChannel<Ping>('ping');

  const pingImpl: Ping = {
    ping: async (): Promise<string> => {
      return 'pong';
    },
  };
  rpcExtension.registerInstance(channel, pingImpl);

  // get proxy
  const proxy = rpcBrowser.getProxy<Ping>(channel);
  expect(await proxy.ping()).toBe('pong');
});

test('Test register channel one argument', async () => {
  const rpcExtension = new RpcExtension(webview);
  rpcExtension.init();
  const rpcBrowser = new RpcBrowser(window, api);

  type Double = {
    double: (value: number) => Promise<number>;
  };

  const channel = createRpcChannel<Double>('double');

  const doubleImpl: Double = {
    double: async (value: number): Promise<number> => {
      return value * 2;
    },
  };
  rpcExtension.registerInstance(channel, doubleImpl);

  // get proxy
  const proxy = rpcBrowser.getProxy<Double>(channel);
  expect(await proxy.double(4)).toBe(8);
});

test('Test register channel multiple arguments', async () => {
  const rpcExtension = new RpcExtension(webview);
  rpcExtension.init();
  const rpcBrowser = new RpcBrowser(window, api);

  type Sum = {
    sum: (...args: number[]) => Promise<number>;
  };
  const channel = createRpcChannel<Sum>('sum');

  const sumImpl: Sum = {
    sum: async (...args: number[]): Promise<number> => {
      return args.reduce((prev, current) => prev + current, 0);
    },
  };

  rpcExtension.registerInstance(channel, sumImpl);

  // get proxy
  const proxy = rpcBrowser.getProxy<Sum>(channel);
  expect(await proxy.sum(1, 2, 3, 4, 5)).toBe(15);
});

test('Test register instance with async', async () => {
  class Dummy {
    async ping(): Promise<string> {
      return 'pong';
    }
  }

  const channel = createRpcChannel<Dummy>('Dummy');

  const rpcExtension = new RpcExtension(webview);
  rpcExtension.init();
  const rpcBrowser = new RpcBrowser(window, api);

  rpcExtension.registerInstance(channel, new Dummy());

  const proxy = rpcBrowser.getProxy<Dummy>(channel);
  expect(await proxy.ping()).toBe('pong');
});

test('Test register instance and implemented interface', async () => {
  interface Foo {
    ping(): Promise<'pong'>;
  }

  class Dummy implements Foo {
    async ping(): Promise<'pong'> {
      return 'pong';
    }
  }
  const channel = createRpcChannel<Foo>('Foo');

  const rpcExtension = new RpcExtension(webview);
  rpcExtension.init();
  const rpcBrowser = new RpcBrowser(window, api);

  rpcExtension.registerInstance(channel, new Dummy());

  const proxy = rpcBrowser.getProxy<Foo>(channel);
  expect(await proxy.ping()).toBe('pong');
});

test('Test raising exception', async () => {
  const rpcExtension = new RpcExtension(webview);
  rpcExtension.init();
  const rpcBrowser = new RpcBrowser(window, api);

  type TestError = {
    raiseError: () => Promise<void>;
  };
  const channel = createRpcChannel<TestError>('TestError');

  const testErrorImpl: TestError = {
    raiseError: async (): Promise<void> => {
      throw new Error('big error');
    },
  };
  rpcExtension.registerInstance(channel, testErrorImpl);

  // get proxy
  const proxy = rpcBrowser.getProxy<TestError>(channel);
  await expect(proxy.raiseError).rejects.toThrow('big error');
});

describe('subscribe', () => {
  beforeEach(() => {
    window.addEventListener = vi.fn();
  });

  function getMessageListener(): (event: MessageEvent) => void {
    expect(window.addEventListener).toHaveBeenCalledOnce();
    expect(window.addEventListener).toHaveBeenCalledWith('message', expect.any(Function));
    return vi.mocked(window.addEventListener).mock.calls[0][1] as (event: MessageEvent) => void;
  }

  test('subscriber should be called on event received', async () => {
    const rpcBrowser = new RpcBrowser(window, api);
    const messageListener = getMessageListener();

    interface EventTest {
      foo: string;
    }
    const rpcChannel = createRpcChannel<EventTest>('example');

    const listener = vi.fn();
    rpcBrowser.subscribe<EventTest>(rpcChannel, listener);

    messageListener({
      data: {
        id: rpcChannel.name,
        body: 'hello',
      },
    } as unknown as MessageEvent);

    expect(listener).toHaveBeenCalledOnce();
  });

  test('all subscribers should be called if multiple exists', async () => {
    const rpcBrowser = new RpcBrowser(window, api);
    const messageListener = getMessageListener();

    const listeners = Array.from({ length: 10 }, _ => vi.fn());

    interface EventTest {
      foo: string;
    }
    const rpcChannel = createRpcChannel<EventTest>('example');
    listeners.forEach(listener => rpcBrowser.subscribe(rpcChannel, listener));

    messageListener({
      data: {
        id: rpcChannel.name,
        body: 'hello',
      },
    } as unknown as MessageEvent);

    for (const listener of listeners) {
      expect(listener).toHaveBeenCalledWith('hello');
    }
  });

  test('subscribers which unsubscribe should not be called', async () => {
    const rpcBrowser = new RpcBrowser(window, api);
    const messageListener = getMessageListener();

    const [listenerA, listenerB] = [vi.fn(), vi.fn()];

    interface EventTest {
      foo: string;
    }
    const rpcChannel = createRpcChannel<EventTest>('example');

    const unsubscriberA = rpcBrowser.subscribe(rpcChannel, listenerA);
    const unsubscriberB = rpcBrowser.subscribe(rpcChannel, listenerB);

    messageListener({
      data: {
        id: rpcChannel.name,
        body: 'hello',
      },
    } as unknown as MessageEvent);

    // unsubscriber the listener B
    unsubscriberB.unsubscribe();

    messageListener({
      data: {
        id: rpcChannel.name,
        body: 'hello',
      },
    } as unknown as MessageEvent);

    // unsubscriber the listener A
    unsubscriberA.unsubscribe();

    messageListener({
      data: {
        id: rpcChannel.name,
        body: 'hello',
      },
    } as unknown as MessageEvent);

    expect(listenerA).toHaveBeenCalledTimes(2);
    expect(listenerB).toHaveBeenCalledOnce();
  });
});

describe('no timeout channel', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  test('default function should have a timeout', async () => {
    class Dummy {
      async ping(): Promise<'pong'> {
        return new Promise(vi.fn());
      }
    }

    const channel = createRpcChannel<Dummy>('Timeout');
    const rpcExtension = new RpcExtension(webview);
    rpcExtension.init();
    const rpcBrowser = new RpcBrowser(window, api);

    rpcExtension.registerInstance(channel, new Dummy());

    const proxy = rpcBrowser.getProxy<Dummy>(channel);

    let error: Error | undefined;
    proxy.ping().catch((err: unknown) => {
      error = err as Error;
    });

    await vi.advanceTimersByTimeAsync(5_000);
    expect(error?.message).toBe('Timeout');
  });

  test('noTimeoutChannels should not have a timeout', async () => {
    class DummyTimeout {
      async ping(): Promise<'pong'> {
        return new Promise(resolve => {
          setTimeout(resolve.bind(undefined, 'pong'), 8_000);
        });
      }
    }

    const channel = createRpcChannel<DummyTimeout>('DummyTimeout');

    const rpcExtension = new RpcExtension(webview);
    rpcExtension.init();
    const rpcBrowser = new RpcBrowser(window, api);

    rpcExtension.registerInstance(channel, new DummyTimeout());

    // flag ping method as being without a timeout
    const proxy = rpcBrowser.getProxy<DummyTimeout>(channel, { noTimeoutMethods: ['ping'] });

    let error: Error | undefined;
    let result: 'pong' | undefined;
    proxy
      .ping()
      .then(mResult => {
        result = mResult;
      })
      .catch((err: unknown) => {
        error = err as Error;
      });

    await vi.advanceTimersByTimeAsync(5_000);
    expect(error).toBeUndefined();
    await vi.advanceTimersByTimeAsync(5_000);
    expect(error).toBeUndefined();
    expect(result).toBe('pong');
  });
});

test('dispose', () => {
  const dummyWebview = { onDidReceiveMessage: vi.fn() } as unknown as Webview;
  const fakeDispose = vi.fn();
  vi.mocked(dummyWebview.onDidReceiveMessage).mockReturnValue({ dispose: fakeDispose });
  const rpcExtension = new RpcExtension(dummyWebview);
  rpcExtension.init();

  // call dispose
  rpcExtension.dispose();

  expect(fakeDispose).toHaveBeenCalledOnce();
});

describe('rpcExtension onDidReceiveMessage', () => {
  const dummyWebview = { onDidReceiveMessage: vi.fn() } as unknown as Webview;
  const fakeDispose = vi.fn();
  let rpcExtension: RpcExtension;

  let onDidReceiveMessageCallback: (message: unknown) => void;

  beforeEach(() => {
    vi.mocked(dummyWebview.onDidReceiveMessage).mockReturnValue({ dispose: fakeDispose });
    rpcExtension = new RpcExtension(dummyWebview);
    rpcExtension.init();
    // get the callback from the onDidReceiveMessage call
    onDidReceiveMessageCallback = vi.mocked(dummyWebview.onDidReceiveMessage).mock.calls[0][0];
    // expect it is defined
    expect(onDidReceiveMessageCallback).toBeDefined();
  });

  test('isMessageRequest', () => {
    // send a message that is not a request
    onDidReceiveMessageCallback('');

    // check that console.error was called
    expect(console.error).toHaveBeenCalledWith('Received incompatible message.', '');
  });

  test('hasInstance', async () => {
    // send a message that is a 'valid' request
    await expect(
      onDidReceiveMessageCallback({ id: 'test', channel: 'test', method: 'test', args: [] }),
    ).rejects.toThrow('channel does not exist.');

    // check that console.error was called
    expect(console.error).toHaveBeenCalledWith('Trying to call on an unknown channel test. Available: ');
  });
});
