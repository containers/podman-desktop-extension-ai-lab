export interface ModelResponse {
  created: number;
  object: string;
  id: string;
  model: string;
  choices: ModelResponseChoice[];
  usage?: ModelResponseUsage;
}

export interface ModelResponseChoice {
  index: number;
  finish_reason: string;
  text: string;
}

export interface ModelResponseUsage {
  prompt_tokens: number;
  completion_tokens: number;
  total_tokens: number;
}
