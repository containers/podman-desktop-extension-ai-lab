export type PlaygroundStatus = 'none' | 'stopped' | 'running' | 'starting' | 'stopping' | 'error';

export interface PlaygroundState {
  container?: {
    containerId: string;
    port: number;
    engineId: string;
  };
  modelId: string;
  status: PlaygroundStatus;
  error?: string;
}
