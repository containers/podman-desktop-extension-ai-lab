import type { ModelResponse } from './IModelResponse';

type PlaygroundStatus = 'none' | 'stopped' | 'starting' | 'stopping' | 'running' | 'error';

export interface QueryState {
  id: number;
  modelId: string;
  prompt: string;
  response?: ModelResponse;
}
