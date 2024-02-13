<script lang="ts">
import type { EnvironmentState } from '@shared/src/models/IEnvironmentState';
import NavPage from '../lib/NavPage.svelte';
import Table from '../lib/table/Table.svelte';
import { Column, Row } from '../lib/table/table';
import { environmentStates } from '/@/stores/environment-states';
import ColumnName from '../lib/table/environment/ColumnName.svelte';
import ColumnActions from '../lib/table/environment/ColumnActions.svelte';
import ColumnStatus from '../lib/table/environment/ColumnStatus.svelte';

const columns: Column<EnvironmentState>[] = [
  new Column<EnvironmentState>('Name', { width: '3fr', renderer: ColumnName }),
  new Column<EnvironmentState>('Status', { width: '80px', renderer: ColumnStatus }),
  new Column<EnvironmentState>('Actions', { align: 'right', width: '120px', renderer: ColumnActions }),
];
const row = new Row<EnvironmentState>({});
</script>

<NavPage title="Environments" searchEnabled="{false}">
  <div slot="content" class="flex flex-col min-w-full min-h-full">
    <div class="min-w-full min-h-full flex-1">
      <div class="mt-4 px-5 space-y-5 h-full">
        {#if $environmentStates.length > 0}
          <Table kind="environment" data="{$environmentStates}" columns="{columns}" row="{row}"></Table>
        {:else}
          <div role="status">There is no environment yet</div>
        {/if}
      </div>
    </div>
  </div>
</NavPage>
