<script lang="ts">
import NavPage from '../lib/NavPage.svelte';
import Table from '../lib/table/Table.svelte';
import { Column, Row } from '../lib/table/table';
import { applicationStates } from '../stores/application-states';
import ColumnActions from '../lib/table/application/ColumnActions.svelte';
import ColumnStatus from '../lib/table/application/ColumnStatus.svelte';
import ColumnRecipe from '../lib/table/application/ColumnRecipe.svelte';
import ColumnModel from '../lib/table/application/ColumnModel.svelte';
import ColumnPod from '../lib/table/application/ColumnPod.svelte';
import ColumnAge from '../lib/table/application/ColumnAge.svelte';
import { router } from 'tinro';
import type { ApplicationState } from '@shared/src/models/IApplicationState';

const columns: Column<ApplicationState>[] = [
  new Column<ApplicationState>('Status', { width: '70px', align: 'center', renderer: ColumnStatus }),
  new Column<ApplicationState>('Model', { width: '3fr', renderer: ColumnModel }),
  new Column<ApplicationState>('Recipe', { width: '2fr', renderer: ColumnRecipe }),
  new Column<ApplicationState>('Pod', { width: '3fr', renderer: ColumnPod }),
  new Column<ApplicationState>('Age', { width: '2fr', renderer: ColumnAge }),
  new Column<ApplicationState>('Actions', { align: 'right', width: '120px', renderer: ColumnActions }),
];
const row = new Row<ApplicationState>({});

const openApplicationCatalog = () => {
  router.goto('/recipes');
};
</script>

<NavPage title="AI Apps" searchEnabled="{false}">
  <div slot="content" class="flex flex-col min-w-full min-h-full">
    <div class="min-w-full min-h-full flex-1">
      <div class="mt-4 px-5 space-y-5">
        {#if $applicationStates.length > 0}
          <Table kind="AI App" data="{$applicationStates}" columns="{columns}" row="{row}"></Table>
        {:else}
          <div class="w-full flex items-center justify-center">
            <div role="status">
              There is no AI App running. You may run a new AI App via the <a
                href="{'javascript:void(0);'}"
                class="underline"
                role="button"
                title="Open the catalog page"
                on:click="{openApplicationCatalog}">Recipes Catalog</a
              >.
            </div>
          </div>
        {/if}
      </div>
    </div>
  </div>
</NavPage>
