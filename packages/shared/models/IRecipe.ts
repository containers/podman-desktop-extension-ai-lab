import type { ModelInfo } from './IModelInfo';

export interface Recipe {
  id?: string,
  name: string,
  categories: string[],
  description: string,
  icon?: string,
  repository: string,
  readme: string,
  config?: string,
  models?: ModelInfo[],
}
