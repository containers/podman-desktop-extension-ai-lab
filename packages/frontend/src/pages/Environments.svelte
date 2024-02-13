<script lang="ts">
import { recipes } from '/@/stores/recipe';

import NavPage from '../lib/NavPage.svelte';
import Table from '../lib/table/Table.svelte';
import { Column, Row } from '../lib/table/table';
import ColumnName from '../lib/table/environment/ColumnName.svelte';
import ColumnActions from '../lib/table/environment/ColumnActions.svelte';
import ColumnStatus from '../lib/table/environment/ColumnStatus.svelte';
import type { RecipeStatus } from '@shared/src/models/IRecipeStatus';

$: states = Array.from($recipes.values());
$: console.log('recipes', recipes);

const columns: Column<RecipeStatus>[] = [
  new Column<RecipeStatus>('Name', { width: '3fr', renderer: ColumnName }),
  new Column<RecipeStatus>('Status', { width: '80px', renderer: ColumnStatus }),
  new Column<RecipeStatus>('Actions', { align: 'right', width: '80px', renderer: ColumnActions }),
];
const row = new Row<RecipeStatus>({});
</script>

<NavPage title="Environments" searchEnabled={false}>
  <div slot="content" class="flex flex-col min-w-full min-h-full">
    <div class="min-w-full min-h-full flex-1">
      <div class="mt-4 px-5 space-y-5 h-full">
        {#if states.length > 0}
          <Table kind="environment" data={states} {columns} {row}></Table>
        {:else}
          <div role="status">There is no environment yet</div>
        {/if}
      </div>
    </div>
  </div>
</NavPage>
