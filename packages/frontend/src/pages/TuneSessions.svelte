<script lang="ts">
import { faGaugeHigh, faPlusCircle } from '@fortawesome/free-solid-svg-icons';
import { Button, EmptyScreen, NavPage, Tab, Table, TableColumn, TableRow } from '@podman-desktop/ui-svelte';
import { onMount } from 'svelte';
import { instructlabSessions } from '../stores/instructlabSessions';
import type { InstructlabSession } from '@shared/src/models/instructlab/IInstructlabSession';
import InstructlabColumnName from '../lib/table/instructlab/InstructlabColumnName.svelte';
import InstructlabColumnModelName from '../lib/table/instructlab/InstructlabColumnModelName.svelte';
import InstructlabColumnRepository from '../lib/table/instructlab/InstructlabColumnRepository.svelte';
import InstructlabColumnTargetModelName from '../lib/table/instructlab/InstructlabColumnTargetModelName.svelte';
import InstructlabColumnAge from '../lib/table/instructlab/InstructlabColumnAge.svelte';
import InstructlabColumnStatus from '../lib/table/instructlab/InstructlabColumnStatus.svelte';
import { router } from 'tinro';
import Route from '../Route.svelte';

function start() {}

const columns: TableColumn<InstructlabSession>[] = [
  new TableColumn<InstructlabSession>('Name', { width: '120px', renderer: InstructlabColumnName, align: 'left' }),
  new TableColumn<InstructlabSession>('Model', { width: '1fr', renderer: InstructlabColumnModelName, align: 'left' }),
  new TableColumn<InstructlabSession>('Repository', {
    width: '100px',
    renderer: InstructlabColumnRepository,
    align: 'left',
  }),
  new TableColumn<InstructlabSession>('Duration', { width: '70px', renderer: InstructlabColumnAge }),
  new TableColumn<InstructlabSession>('Stage', { width: '80px', renderer: InstructlabColumnStatus, align: 'left' }),
  new TableColumn<InstructlabSession>('Target model', {
    width: '1fr',
    renderer: InstructlabColumnTargetModelName,
    align: 'left',
  }),
];
const row = new TableRow<InstructlabSession>({});

let data: InstructlabSession[];

$: running = data?.filter(t => t.status !== 'fine-tuned');
$: completed = data?.filter(t => t.status === 'fine-tuned');

onMount(() => {
  return instructlabSessions.subscribe(items => {
    data = items;
  });
});
</script>

<NavPage title="InstructLab Sessions" searchEnabled={false}>
  <svelte:fragment slot="tabs">
    <Tab title="All" url="/tune" selected={$router.path === '/tune'} />
    <Tab title="Running" url="/tune/running" selected={$router.path === '/tune/running'} />
    <Tab title="Completed" url="/tune/completed" selected={$router.path === '/tune/completed'} />
  </svelte:fragment>
  <svelte:fragment slot="additional-actions">
    <Button icon={faPlusCircle} on:click={() => start()}>Start Fine Tuning</Button>
  </svelte:fragment>
  <svelte:fragment slot="content">
    <div class="flex min-w-full">
      <!-- All models -->
      <Route path="/">
        {#if data?.length > 0}
          <Table kind="session" data={data} columns={columns} row={row} />
        {:else}
          <EmptyScreen
            aria-label="status"
            icon={faGaugeHigh}
            title="No InstructLab Session"
            message="Create InstructLab session to improve trained models with specialized knowledges and skills tuning">
            <div class="flex gap-2 justify-center">
              <Button type="link" on:click={() => start()}>Create InstructLab Session</Button>
            </div>
          </EmptyScreen>
        {/if}
      </Route>

      <!-- Running models -->
      <Route path="/running">
        {#if running?.length > 0}
          <Table kind="session" data={running} columns={columns} row={row} />
        {:else}
          <EmptyScreen
            aria-label="status"
            icon={faGaugeHigh}
            title="No Running InstructLab Session"
            message="Create InstructLab session to improve trained models with specialized knowledges and skills tuning">
            <div class="flex gap-2 justify-center">
              <Button type="link" on:click={() => start()}>Create InstructLab Session</Button>
            </div>
          </EmptyScreen>
        {/if}
      </Route>

      <!-- Completed models -->
      <Route path="/completed">
        {#if completed?.length > 0}
          <Table kind="session" data={completed} columns={columns} row={row} />
        {:else}
          <EmptyScreen
            aria-label="status"
            icon={faGaugeHigh}
            title="No Completed InstructLab Session"
            message="Create InstructLab session to improve trained models with specialized knowledges and skills tuning">
            <div class="flex gap-2 justify-center">
              <Button type="link" on:click={() => start()}>Create InstructLab Session</Button>
            </div>
          </EmptyScreen>
        {/if}
      </Route>
    </div>
  </svelte:fragment>
</NavPage>
