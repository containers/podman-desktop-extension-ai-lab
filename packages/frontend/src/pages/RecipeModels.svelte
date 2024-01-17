<script lang="ts">
  import type { ModelInfo } from '@shared/src/models/IModelInfo';
  import Table from '../lib/table/Table.svelte';
  import { Column, Row } from '../lib/table/table';
  import ModelColumnName from './ModelColumnName.svelte';
  import ModelColumnRegistry from './ModelColumnRegistry.svelte';
  import ModelColumnPopularity from './ModelColumnPopularity.svelte';
  import ModelColumnLicense from './ModelColumnLicense.svelte';
  import ModelColumnHw from './ModelColumnHW.svelte';
  import { onMount } from 'svelte';
  import { studioClient } from '../utils/client';

  export let modelsIds: string[] | undefined;
  let models: ModelInfo[] = [];

  onMount(async () => {
    if (modelsIds && modelsIds.length > 0) {
      models = await studioClient.getModelsByIds(modelsIds);
    }    
  })

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
  <div class="flex flex-col min-w-full min-h-full">
    <div class="min-w-full min-h-full flex-1">
      <div class="mt-4 px-5 space-y-5 h-full">
        <Table
          kind="model"
          data="{models}"
          columns="{columns}"
          row={row}>
      </Table>
      </div>
    </div>
  </div>
{/if}
