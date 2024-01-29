import type { LocalModelInfo } from './ILocalModelInfo';

export interface ModelInfo {
  id: string;
  name: string;
  description: string;
  hw: string;
  registry: string;
  popularity: number;
  license: string;
  url: string;
  file?: LocalModelInfo;
  state?: 'deleting';
}
