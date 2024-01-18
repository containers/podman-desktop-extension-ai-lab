export type PlaygroundStatus = 'none' | 'stopped' | 'running' | 'starting' | 'stopping' | 'error';

export interface PlaygroundState {
  container?: {
    containerId: string;
    port: number;
  },
  modelId: string,
  status: PlaygroundStatus
}
