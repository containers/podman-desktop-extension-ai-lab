<script lang="ts">
import type { ApplicationState } from '@shared/src/models/IApplicationState';
import NavPage from '../lib/NavPage.svelte';
import Table from '../lib/table/Table.svelte';
import { Column, Row } from '../lib/table/table';
import { environmentStates } from '/@/stores/environment-states';
import ColumnActions from '../lib/table/environment/ColumnActions.svelte';
import ColumnStatus from '../lib/table/environment/ColumnStatus.svelte';
import type { EnvironmentCell } from './environments';
import ColumnRecipe from '../lib/table/environment/ColumnRecipe.svelte';
import ColumnModel from '../lib/table/environment/ColumnModel.svelte';
import ColumnPod from '../lib/table/environment/ColumnPod.svelte';
import ColumnAge from '../lib/table/environment/ColumnAge.svelte';
import { filterByLabel } from '/@/utils/taskUtils';
import { tasks } from '/@/stores/tasks';

let data: EnvironmentCell[];

$: data = $environmentStates.map((env: ApplicationState) => ({
  recipeId: env.recipeId,
  modelId: env.modelId,
  appPorts: env.appPorts,
  modelPorts: env.modelPorts,
  envState: env,
  tasks: filterByLabel($tasks, {
    'recipe-id': env.recipeId,
    'model-id': env.modelId,
  }),
}));

const columns: Column<EnvironmentCell>[] = [
  new Column<EnvironmentCell>('Model', { width: '3fr', renderer: ColumnModel }),
  new Column<EnvironmentCell>('Recipe', { width: '2fr', renderer: ColumnRecipe }),
  new Column<EnvironmentCell>('Pod', { width: '3fr', renderer: ColumnPod }),
  new Column<EnvironmentCell>('Age', { width: '2fr', renderer: ColumnAge }),
  new Column<EnvironmentCell>('Status', { width: '3fr', renderer: ColumnStatus }),
  new Column<EnvironmentCell>('Actions', { align: 'right', width: '120px', renderer: ColumnActions }),
];
const row = new Row<EnvironmentCell>({});
</script>

<NavPage title="AI Apps" searchEnabled="{false}">
  <div slot="content" class="flex flex-col min-w-full min-h-full">
    <div class="min-w-full min-h-full flex-1">
      <div class="mt-4 px-5 space-y-5 h-full">
        {#if data.length > 0}
          <Table kind="AI App" data="{data}" columns="{columns}" row="{row}"></Table>
        {:else}
          <div role="status">There is no AI App yet</div>
        {/if}
      </div>
    </div>
  </div>
</NavPage>
