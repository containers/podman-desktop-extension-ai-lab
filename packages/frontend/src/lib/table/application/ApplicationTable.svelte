<script lang="ts">
import { applicationStates } from '/@/stores/application-states';
import ColumnActions from './ColumnActions.svelte';
import ColumnStatus from './ColumnStatus.svelte';
import ColumnRecipe from './ColumnRecipe.svelte';
import ColumnModel from './ColumnModel.svelte';
import ColumnPod from './ColumnPod.svelte';
import ColumnAge from './ColumnAge.svelte';
import { onMount } from 'svelte';
import type { ApplicationState } from '@shared/src/models/IApplicationState';
import { Table, TableColumn, TableRow } from '@podman-desktop/ui-svelte';
export let filter: ((items: ApplicationState[]) => ApplicationState[]) | undefined = undefined;
const columns: TableColumn<ApplicationState>[] = [
  new TableColumn<ApplicationState>('Status', { width: '70px', align: 'center', renderer: ColumnStatus }),
  new TableColumn<ApplicationState>('Model', { width: '3fr', renderer: ColumnModel }),
  new TableColumn<ApplicationState>('Recipe', { width: '2fr', renderer: ColumnRecipe }),
  new TableColumn<ApplicationState>('Pod', { width: '3fr', renderer: ColumnPod }),
  new TableColumn<ApplicationState>('Age', { width: '2fr', renderer: ColumnAge }),
  new TableColumn<ApplicationState>('Actions', {
    align: 'right',
    width: '120px',
    renderer: ColumnActions,
    overflow: true,
  }),
];
const row = new TableRow<ApplicationState>({});
let data: (ApplicationState & { selected?: boolean })[];
onMount(() => {
  return applicationStates.subscribe(items => {
    data = filter ? filter(items) : items;
  });
});
</script>

{#if data?.length > 0}
  <Table kind="AI App" data="{data}" columns="{columns}" row="{row}"></Table>
{:else}
  <slot name="empty-screen" />
{/if}
