import type { ModelInfo } from '@shared/src/models/IModelInfo';

export interface RecipeModelInfo extends ModelInfo {
  recommended: boolean;
  inUse: boolean;
}
