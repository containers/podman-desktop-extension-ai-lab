<script lang="ts">
import type { ModelInfo } from '@shared/src/models/IModelInfo';
import Table from '/@/lib/table/Table.svelte';
import { Column, Row } from '/@/lib/table/table';
import ModelColumnName from '/@/lib/table/model/ModelColumnName.svelte';
import ModelColumnRegistry from '/@/lib/table/model/ModelColumnRegistry.svelte';
import ModelColumnPopularity from '/@/lib/table/model/ModelColumnPopularity.svelte';
import ModelColumnLicense from '/@/lib/table/model/ModelColumnLicense.svelte';
import ModelColumnHw from '/@/lib/table/model/ModelColumnHW.svelte';
import { catalog } from '/@/stores/catalog';

export let modelsIds: string[] | undefined;

$: models = $catalog.models.filter(m => modelsIds?.includes(m.id));

const columns: Column<ModelInfo>[] = [
  new Column<ModelInfo>('Name', { width: '4fr', renderer: ModelColumnName }),
  new Column<ModelInfo>('HW Compat', { width: '1fr', renderer: ModelColumnHw }),
  new Column<ModelInfo>('Registry', { width: '1fr', renderer: ModelColumnRegistry }),
  new Column<ModelInfo>('Popularity', { width: '1fr', renderer: ModelColumnPopularity }),
  new Column<ModelInfo>('License', { width: '1fr', renderer: ModelColumnLicense }),
];
const row = new Row<ModelInfo>({});
</script>

{#if models}
  <div class="flex flex-col grow min-h-full">
    <div class="w-full min-h-full flex-1">
      <div class="h-full">
        <Table kind="model" data="{models}" columns="{columns}" row="{row}" headerBackground="bg-transparent"></Table>
      </div>
    </div>
  </div>
{/if}
