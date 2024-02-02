import type { ModelResponse } from './IModelResponse';

export interface QueryState {
  id: number;
  modelId: string;
  prompt: string;
  response?: ModelResponse;
  error?: string;
}
