import type { Category } from './ICategory';
import type { ModelInfo } from './IModelInfo';
import type { Recipe } from './IRecipe';

export interface Catalog {
  recipes: Recipe[];
  models: ModelInfo[];
  categories: Category[];
}
