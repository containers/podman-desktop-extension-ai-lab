<script lang="ts">
import { Column, Row } from '/@/lib/table/table';
import type { InferenceServer } from '@shared/src/models/IInference';
import ServiceColumnName from '/@/lib/table/service/ServiceColumnName.svelte';
import NavPage from '/@/lib/NavPage.svelte';
import Table from '/@/lib/table/Table.svelte';
import { inferenceServers } from '/@/stores/inferenceServers';
import ServiceStatus from '/@/lib/table/service/ServiceStatus.svelte';
import ServiceAction from '/@/lib/table/service/ServiceAction.svelte';
import ServiceColumnModelName from '/@/lib/table/service/ServiceColumnModelName.svelte';

const columns: Column<InferenceServer>[] = [
  new Column<InferenceServer>('Status', { width: '50px', renderer: ServiceStatus, align: 'center' }),
  new Column<InferenceServer>('Name', { width: '1fr', renderer: ServiceColumnName, align: 'center' }),
  new Column<InferenceServer>('Model', { width: '3fr', renderer: ServiceColumnModelName, align: 'center' }),
  new Column<InferenceServer>('Action', { width: '50px', renderer: ServiceAction, align: 'center' }),
];
const row = new Row<InferenceServer>({});

let data: InferenceServer[];
$: data = $inferenceServers;
</script>

<NavPage title="Services" searchEnabled="{false}">
  <svelte:fragment slot="content">
    <div slot="content" class="flex flex-col min-w-full min-h-full">
      <div class="min-w-full min-h-full flex-1">
        <div class="mt-4 px-5 space-y-5 h-full">
          {#if data.length > 0}
            <Table kind="service" data="{data}" columns="{columns}" row="{row}"></Table>
          {:else}
            <div role="status">There is no services running for now.</div>
          {/if}
        </div>
      </div>
    </div>
  </svelte:fragment>
</NavPage>
