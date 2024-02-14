<script lang="ts">
import Table from '/@/lib/table/Table.svelte';
import { Column, Row } from '/@/lib/table/table';
import ModelColumnName from '/@/lib/table/model/ModelColumnName.svelte';
import ModelColumnRegistry from '/@/lib/table/model/ModelColumnRegistry.svelte';
import ModelColumnLicense from '/@/lib/table/model/ModelColumnLicense.svelte';
import ModelColumnHw from '/@/lib/table/model/ModelColumnHW.svelte';
import { catalog } from '/@/stores/catalog';
import ModelColumnRecipeSelection from '../lib/table/model/ModelColumnRecipeSelection.svelte';
import ModelColumnRecipeRecommended from '../lib/table/model/ModelColumnRecipeRecommended.svelte';
import type { RecipeModelInfo } from '../models/RecipeModelInfo';

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
  new Column<RecipeModelInfo>('Name', { width: '4fr', renderer: ModelColumnName }),
  new Column<RecipeModelInfo>('HW Compat', { width: '1fr', renderer: ModelColumnHw }),
  new Column<RecipeModelInfo>('Registry', { width: '1fr', renderer: ModelColumnRegistry }),
  new Column<RecipeModelInfo>('Recommended', { width: '1fr', renderer: ModelColumnRecipeRecommended }),
  new Column<RecipeModelInfo>('License', { width: '1fr', renderer: ModelColumnLicense }),
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
