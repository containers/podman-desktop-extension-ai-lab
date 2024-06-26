import type { InferenceServerInfo, RuntimeType } from '@shared/src/models/IInference';
import { Publisher } from '../utils/Publisher';
import { Disposable, type Webview } from '@podman-desktop/api';
import { Messages } from '@shared/Messages';
import type { InferenceServerInstance, RuntimeEngine } from '../managers/inference/RuntimeEngine';

export class InferenceServerRegistry extends Publisher<InferenceServerInfo[]> {
  readonly #engines: Map<string, RuntimeEngine>;

  constructor(webview: Webview) {
    super(webview, Messages.MSG_INFERENCE_SERVERS_UPDATE, () => this.getInferenceServerInfo());

    this.#engines = new Map();
  }

  public register(runtime: RuntimeEngine): Disposable {
    this.#engines.set(runtime.id, runtime);

    const disposable = runtime.onUpdate(() => this.notify());

    return Disposable.create(() => {
      disposable.dispose();
      this.unregister(runtime.id);
    });
  }

  public getRuntime(type: RuntimeType): RuntimeEngine {
    const runtime = Array.from(this.#engines.values()).find(engine => engine.runtime === type);
    if (!runtime) throw new Error(`no runtime registered for ${type}`);
    return runtime;
  }

  public unregister(id: string): void {
    this.#engines.delete(id);
  }

  public getInstances(): InferenceServerInstance[] {
    return Array.from(this.#engines.values())
      .map(engine => engine.getServers())
      .flat();
  }

  get(serverId: string): InferenceServerInstance {
    const instances = this.getInstances();
    const result = instances.find(instance => instance.id === serverId);
    if (!result) throw new Error(`no inference server instance was found with id ${serverId}`);
    return result;
  }

  private toInferenceServer(instance: InferenceServerInstance): InferenceServerInfo {
    return {
      type: instance.type,
      models: instance.models,
      connection: instance.connection,
      container: instance.container,
      exit: instance.exit,
      health: instance.health,
      status: instance.status,
    };
  }

  public getInferenceServerInfo(): InferenceServerInfo[] {
    return this.getInstances().map(instance => this.toInferenceServer(instance));
  }
}