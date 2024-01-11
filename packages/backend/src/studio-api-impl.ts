import type { StudioAPI } from '@shared/StudioAPI';
import { Category } from '@shared/models/ICategory';
import { Recipe } from '@shared/models/IRecipe';
import content from './ai.json';
import { Task } from '@shared/models/ITask';
import { ModelInfo } from '@shared/models/IModelInfo';
import { Studio } from './studio';
import * as path from 'node:path';
import * as http from 'node:http';

export const RECENT_CATEGORY_ID = 'recent-category';

export class StudioApiImpl implements StudioAPI {

  private status: Map<string, Task[]> = new Map<string, Task[]>();

  constructor(private studio: Studio) {}

  async getPullingStatus(recipeId: string): Promise<Task[]> {
      return this.status.get(recipeId) || [];
  }

  async ping(): Promise<string> {
    return 'pong';
  }

  async getRecentRecipes(): Promise<Recipe[]> {
    return content.recipes.toSpliced(0, 10);
  }

  async getCategories(): Promise<Category[]> {
    return content.categories;
  }

  async getRecipesByCategory(categoryId: string): Promise<Recipe[]> {
    if (categoryId === RECENT_CATEGORY_ID) return this.getRecentRecipes();

    return content.recipes.filter(recipe => recipe.categories.includes(categoryId));
  }

  async getRecipeById(recipeId: string): Promise<Recipe> {
    const recipe = (content.recipes as Recipe[]).find(recipe => recipe.id === recipeId);
    if (recipe) return recipe;
    throw new Error('Not found');
  }

  async getModelById(modelId: string): Promise<ModelInfo> {
    const model = content.recipes.flatMap(r => (r.models as ModelInfo[]).filter(m => modelId === m.id));
    if (model.length === 1) return model[0];
    if (model.length === 0) throw new Error('Not found');
    throw new Error('several models with same id');
  }

  async searchRecipes(query: string): Promise<Recipe[]> {
    return []; // todo: not implemented
  }

  async pullApplication(recipeId: string): Promise<void> {
    const recipe: Recipe = await this.getRecipeById(recipeId);
    this.status.set(recipeId, [{state: 'loading', name: 'Pulling application'}]);


    //todo: stuff here
    return Promise.resolve(undefined);
  }

  async getLocalModels(): Promise<ModelInfo[]> {
    const local = this.studio.getLocalModels();
    const localIds = local.map(l => l.id);
    return content.recipes.flatMap(r => r.models.filter(m => localIds.includes(m.id)));
  }

  async startPlayground(modelId: string): Promise<void> {
    const locals = this.studio.getLocalModels();
    const localModelInfo = this.studio.getLocalModels().filter(m => m.id === modelId);
    if (localModelInfo.length !== 1) {
      throw new Error('model not found');
    }
    const modelPath = path.resolve(this.studio.extensionContext.storagePath, 'models', localModelInfo[0].id, localModelInfo[0].file);
    this.studio.playgroundManager.startPlayground(modelId, modelPath);
  }

  askPlayground(modelId: string, prompt: string): Promise<any> {
    return new Promise((resolve,reject) => {
      const locals = this.studio.getLocalModels();
      const localModelInfo = this.studio.getLocalModels().filter(m => m.id === modelId);
      if (localModelInfo.length !== 1) {
        throw new Error('model not found');
      }
      var post_data = JSON.stringify({
        "model": localModelInfo[0].file,
        "prompt": prompt,
        "temperature": 0.7
      });

      var post_options: http.RequestOptions = {
        host: 'localhost',
        port: '9000',
        path: '/v1/completions',
        method: 'POST',
        headers: {
            'Content-Type': 'application/json'
        }
      };

      var post_req = http.request(post_options, function(res) {
        res.setEncoding('utf8');
        const chunks = [];
        res.on('data', (data) => chunks.push(data));
        res.on('end', () => {
          let resBody = chunks.join();
          switch(res.headers['content-type']) {
              case 'application/json':
                  const result = JSON.parse(resBody);
                  console.log('result', result);
                  resolve(result);
                  break;
          }
        });
      });
      // post the data
      console.log('send data', post_data);
      post_req.on('socket', function (socket) {
        socket.setTimeout(1000000);  
      });
      post_req.write(post_data);
      post_req.end();
    });
  }
}
