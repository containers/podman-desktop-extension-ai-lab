<script lang="ts">
import type { ApplicationState } from '@shared/src/models/IApplicationState';
import NavPage from '../lib/NavPage.svelte';
import Table from '../lib/table/Table.svelte';
import { Column, Row } from '../lib/table/table';
import { applicationStates } from '../stores/application-states';
import ColumnActions from '../lib/table/application/ColumnActions.svelte';
import ColumnStatus from '../lib/table/application/ColumnStatus.svelte';
import type { ApplicationCell } from './applications';
import ColumnRecipe from '../lib/table/application/ColumnRecipe.svelte';
import ColumnModel from '../lib/table/application/ColumnModel.svelte';
import ColumnPod from '../lib/table/application/ColumnPod.svelte';
import ColumnAge from '../lib/table/application/ColumnAge.svelte';
import { filterByLabel } from '/@/utils/taskUtils';
import { tasks } from '/@/stores/tasks';
import { router } from 'tinro';

let data: ApplicationCell[];

$: data = $applicationStates.map((app: ApplicationState) => ({
  recipeId: app.recipeId,
  modelId: app.modelId,
  appPorts: app.appPorts,
  modelPorts: app.modelPorts,
  appState: app,
  tasks: filterByLabel($tasks, {
    'recipe-id': app.recipeId,
    'model-id': app.modelId,
  }),
}));

const columns: Column<ApplicationCell>[] = [
  new Column<ApplicationCell>('Model', { width: '3fr', renderer: ColumnModel }),
  new Column<ApplicationCell>('Recipe', { width: '2fr', renderer: ColumnRecipe }),
  new Column<ApplicationCell>('Pod', { width: '3fr', renderer: ColumnPod }),
  new Column<ApplicationCell>('Age', { width: '2fr', renderer: ColumnAge }),
  new Column<ApplicationCell>('Status', { width: '3fr', renderer: ColumnStatus }),
  new Column<ApplicationCell>('Actions', { align: 'right', width: '120px', renderer: ColumnActions }),
];
const row = new Row<ApplicationCell>({});

const openApplicationCatalog = () => {
  router.goto('/recipes');
};
</script>

<NavPage title="AI Apps" searchEnabled="{false}">
  <div slot="content" class="flex flex-col min-w-full min-h-full">
    <div class="min-w-full min-h-full flex-1">
      <div class="mt-4 px-5 space-y-5 h-full">
        {#if data.length > 0}
          <Table kind="AI App" data="{data}" columns="{columns}" row="{row}"></Table>
        {:else}
          <div class="w-full flex items-center justify-center">
            <div role="status">
              There is no AI App running. Explore the one available in the <a
                href="{'javascript:void(0);'}"
                class="underline"
                role="button"
                title="Open the catalog page"
                on:click="{openApplicationCatalog}">application catalog</a
              >.
            </div>
          </div>
        {/if}
      </div>
    </div>
  </div>
</NavPage>
