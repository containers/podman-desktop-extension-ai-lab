<script lang="ts">
import Table from '/@/lib/table/Table.svelte';
import { Column, Row } from '/@/lib/table/table';
import ModelColumnName from '/@/lib/table/model/ModelColumnName.svelte';
import { catalog } from '/@/stores/catalog';
import ModelColumnRecipeSelection from '../lib/table/model/ModelColumnRecipeSelection.svelte';
import ModelColumnRecipeRecommended from '../lib/table/model/ModelColumnRecipeRecommended.svelte';
import type { RecipeModelInfo } from '../models/RecipeModelInfo';
import ModelColumnLabels from '/@/lib/table/model/ModelColumnLabels.svelte';

export let modelsIds: string[] | undefined;
export let selectedModelId: string;
export let setSelectedModel: (modelId: string) => void;

$: models = $catalog.models
  .filter(m => modelsIds?.includes(m.id))
  .map((m, i) => {
    return {
      ...m,
      recommended: i === 0,
      inUse: m.id === selectedModelId,
    } as RecipeModelInfo;
  });

const columns: Column<RecipeModelInfo>[] = [
  new Column<RecipeModelInfo>('', { width: '20px', renderer: ModelColumnRecipeSelection }),
  new Column<RecipeModelInfo>('', { width: '20px', renderer: ModelColumnRecipeRecommended }),
  new Column<RecipeModelInfo>('Name', { width: '4fr', renderer: ModelColumnName }),
  new Column<RecipeModelInfo>('', { align: 'right', width: '220px', renderer: ModelColumnLabels }),
];
const row = new Row<RecipeModelInfo>({});

function setModelToUse(selected: RecipeModelInfo) {
  setSelectedModel(selected.id);
}
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
