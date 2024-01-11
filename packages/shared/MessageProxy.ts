import type { PodmanDesktopApi } from '../../types/podman-desktop-api';
import type { Webview } from '@podman-desktop/api';

export interface IMessage {
  id: number;
  channel: string;
}

export interface IMessageRequest extends IMessage{
  args: any[];
}

export interface IMessageResponse extends IMessageRequest {
  status: 'error' | 'success';
  error?: string | undefined;
  body: any;
}

export function isMessageRequest(content: any): content is IMessageRequest {
  return content !== undefined && content !== null && 'id' in content && 'channel' in content;
}

export function isMessageResponse(content: any): content is IMessageResponse {
  return isMessageRequest(content) && 'status' in content
}

export class RpcExtension {
  methods: Map<string, (...args: any[]) => Promise<any>> = new Map();

  constructor(private webview: Webview) {
    this.init();
  }

  init() {
    this.webview.onDidReceiveMessage(async (message: any) => {
      if(!isMessageRequest(message)) {
        console.error("Received incompatible message.", message);
        return;
      }

      if(!this.methods.has(message.channel)) {
        console.error(`Trying to call on an unknown channel ${message.channel}. Available: ${Array.from(this.methods.keys())}`);
        return;
      }

      try {
        const result = await this.methods.get(message.channel)?.(...message.args);
        this.webview.postMessage({
          id: message.id,
          channel: message.channel,
          body: result,
          status: 'success',
        } as IMessageResponse);
      } catch (e) {
        this.webview.postMessage({
          id: message.id,
          channel: message.channel,
          body: undefined,
          error: `Something went wrong on channel ${message.channel}: ${String(e)}`
        } as IMessageResponse);
      }
    });
  }

  registerInstance<T>(classType: { new (...args: any[]): T }, instance: T) {
    const methodNames = Object.getOwnPropertyNames(classType.prototype)
      .filter(name => name !== 'constructor' && typeof instance[name] === 'function');

    methodNames.forEach(name => {
      const method = instance[name].bind(instance);
      this.register(name, method);
    });
  }

  register(channel: string, method: (body: any) => any) {
    this.methods.set(channel, method);
  }
}

export class RpcBrowser {
  counter: number = 0;
  promises: Map<number, {resolve: (value: unknown) => any, reject: (value: unknown) => void}> = new Map();

  getUniqueId(): number {
    return ++this.counter;
  }

  constructor(private window: Window, private api: PodmanDesktopApi) {
   this.init();
  }

  init() {
    this.window.addEventListener('message', (event: MessageEvent) => {
      const message = event.data;
      if(!isMessageResponse(message)) {
        console.error("Received incompatible message.", message);
        return;
      }

      if(!this.promises.has(message.id)) {
        console.error('Unknown message id.');
        return;
      }

      const { resolve, reject } = this.promises.get(message.id) || {};

      if(message.status === 'error') {
        reject?.(message.error)
      } else {
        resolve?.(message.body);
      }
      this.promises.delete(message.id);
    })
  }

  getProxy<T>(): T {
    const thisRef = this;
    const proxyHandler: ProxyHandler<any> = {
      get(target, prop, receiver) {
        if (typeof prop === 'string') {
          return (...args: any[]) => {
            const channel = prop.toString();
            return thisRef.invoke(channel, ...args);
          };
        }
        return Reflect.get(target, prop, receiver);
      },
    };

    return new Proxy({}, proxyHandler) as T;
  }

  async invoke(channel: string, ...args: any[]): Promise<any> {
    // Generate a unique id for the request
    const requestId = this.getUniqueId();

    // Post the message
    this.api.postMessage({
      id: requestId,
      channel: channel,
      args: args
    } as IMessageRequest);

    // Add some timeout
    setTimeout(() => {
      const {reject} = this.promises.get(requestId) || {};
      if(!reject)
        return;
      reject(new Error('Timeout'));
      this.promises.delete(requestId);
    }, 10000);

    // Create a Promise
    return new Promise((resolve, reject) => {
      this.promises.set(requestId, {resolve, reject});
    })
  }
}
