<script lang="ts">
  import type { ModelInfo } from '@shared/models/IModelInfo';
  import NavPage from '../lib/NavPage.svelte';
  import Table from '../lib/table/Table.svelte';
  import { Column, Row } from '../lib/table/table';
  import { localModels } from '../stores/local-models';
  import ModelColumnName from './ModelColumnName.svelte';
  import ModelColumnRegistry from './ModelColumnRegistry.svelte';
  import ModelColumnPopularity from './ModelColumnPopularity.svelte';
  import ModelColumnLicense from './ModelColumnLicense.svelte';
  import ModelColumnHw from './ModelColumnHW.svelte';

  const columns: Column<ModelInfo>[] = [
    new Column<ModelInfo>('Name', { width: '4fr', renderer: ModelColumnName }),
    new Column<ModelInfo>('HW Compat', { width: '1fr', renderer: ModelColumnHw }),
    new Column<ModelInfo>('Registry', { width: '1fr', renderer: ModelColumnRegistry }),
    new Column<ModelInfo>('Popularity', { width: '1fr', renderer: ModelColumnPopularity }),
    new Column<ModelInfo>('License', { width: '1fr', renderer: ModelColumnLicense }),
  ];
  const row = new Row<ModelInfo>({});

</script>

<NavPage title="Models on disk">
  <div slot="content" class="flex flex-col min-w-full min-h-full">
    <div class="min-w-full min-h-full flex-1">
      <div class="px-5 space-y-5 h-full">
        <Table
          kind="model"
          data="{$localModels}"
          columns="{columns}"
          row={row}>
      </Table>
      </div>
    </div>
  </div>
</NavPage>
