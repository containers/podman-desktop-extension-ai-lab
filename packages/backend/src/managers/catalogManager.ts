import type { Catalog } from '@shared/src/models/ICatalog';
import path from 'node:path';
import fs from 'node:fs';
import defaultCatalog from '../ai.json';
import { Category } from '@shared/src/models/ICategory';
import { Recipe } from '@shared/src/models/IRecipe';
import { ModelInfo } from '@shared/src/models/IModelInfo';

export class CatalogManager {
  private catalog: Catalog;

  constructor(private appUserDirectory: string) {
    // We start with an empty catalog, for the methods to work before the catalog is loaded
    this.catalog = {
      categories: [],
      models: [],
      recipes: [],
    };
  }

  public getCategories(): Category[] {
    return this.catalog.categories;
  }

  public getModels(): ModelInfo[] {
    return this.catalog.models;
  }
  public getRecipes(): Recipe[] {
    return this.catalog.recipes;
  }


  async loadCatalog() {
    const catalogPath = path.resolve(this.appUserDirectory, 'catalog.json');
    try {
      if (!fs.existsSync(catalogPath)) {
        this.setCatalog(defaultCatalog);
        return;
      }
      // TODO(feloy): watch catalog file and update catalog with new content
      const data = await fs.promises.readFile(catalogPath, 'utf-8');
      const cat = JSON.parse(data) as Catalog;
      this.setCatalog(cat);
    } catch (err: unknown) {
      console.error('unable to read catalog file, reverting to default catalog', err);
      this.setCatalog(defaultCatalog);
    }
  }

  setCatalog(newCatalog: Catalog) {
    // TODO(feloy): send message to frontend with new catalog
    this.catalog = newCatalog;
  }
}
