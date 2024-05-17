<script lang="ts">
import Table from '/@/lib/table/Table.svelte';
import { Column, Row } from '/@/lib/table/table';
import ModelColumnName from '/@/lib/table/model/ModelColumnName.svelte';
import { catalog } from '/@/stores/catalog';
import ModelColumnRecipeSelection from '../lib/table/model/ModelColumnRecipeSelection.svelte';
import ModelColumnRecipeRecommended from '../lib/table/model/ModelColumnRecipeRecommended.svelte';
import type { RecipeModelInfo } from '../models/RecipeModelInfo';
import ModelColumnIcon from '/@/lib/table/model/ModelColumnIcon.svelte';
import { onMount } from 'svelte';
import type { ModelInfo } from '@shared/src/models/IModelInfo';

export let modelsIds: string[] | undefined;
export let selectedModelId: string;
export let setSelectedModel: (modelId: string) => void;

let models: RecipeModelInfo[] = [];

const columns: Column<RecipeModelInfo>[] = [
  new Column<RecipeModelInfo>('', { width: '20px', renderer: ModelColumnRecipeSelection }),
  new Column<RecipeModelInfo>('', { width: '20px', renderer: ModelColumnRecipeRecommended }),
  new Column<RecipeModelInfo>('', { width: '32px', renderer: ModelColumnIcon }),
  new Column<RecipeModelInfo>('Name', { width: '4fr', renderer: ModelColumnName }),
];
const row = new Row<RecipeModelInfo>({});

function setModelToUse(selected: RecipeModelInfo) {
  setSelectedModel(selected.id);
  // update inUse models
  models = models.map(model => ({...model, inUse: model.id === selected.id}));
}

onMount(() => {
  return catalog.subscribe((catalog) => {
    let mModels: ModelInfo[];
    // If we do not have any models id provided, we just provide all
    if(modelsIds === undefined || modelsIds.length === 0) {
      mModels = catalog.models;
    } else {
      mModels= catalog.models.filter(m => modelsIds?.includes(m.id));
    }
    // Map ModelInfo to RecipeModelInfo
    models = mModels.map((m, i) =>  ({
        ...m,
        recommended: i === 0,
        inUse: m.id === selectedModelId,
      }) as RecipeModelInfo
    );
  });
})
</script>

{#if models}
  <div class="flex flex-col grow min-h-full">
    <div class="w-full min-h-full flex-1">
      <div class="h-full">
        <Table
          kind="model"
          data="{models}"
          columns="{columns}"
          row="{row}"
          headerBackground="bg-transparent"
          on:update="{e => setModelToUse(e.detail)}">
        </Table>
      </div>
    </div>
  </div>
{/if}
