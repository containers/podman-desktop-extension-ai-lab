<script lang="ts">
import type { InferenceServer } from '@shared/models/IInference';
import ServiceColumnName from '/@/lib/table/service/ServiceColumnName.svelte';
import { inferenceServers } from '/@/stores/inferenceServers';
import ServiceStatus from '/@/lib/table/service/ServiceStatus.svelte';
import ServiceAction from '/@/lib/table/service/ServiceAction.svelte';
import ServiceColumnModelName from '/@/lib/table/service/ServiceColumnModelName.svelte';
import { faRocket, faPlusCircle, faTrash } from '@fortawesome/free-solid-svg-icons';
import { studioClient } from '/@/utils/client';
import { router } from 'tinro';
import { onMount } from 'svelte';
import { Button, Table, TableColumn, TableRow, NavPage, EmptyScreen } from '@podman-desktop/ui-svelte';

const columns: TableColumn<InferenceServer>[] = [
  new TableColumn<InferenceServer>('Status', { width: '70px', renderer: ServiceStatus, align: 'center' }),
  new TableColumn<InferenceServer>('Name', { width: '1fr', renderer: ServiceColumnName, align: 'left' }),
  new TableColumn<InferenceServer>('Model', { renderer: ServiceColumnModelName, align: 'left' }),
  new TableColumn<InferenceServer>('Actions', { width: '80px', renderer: ServiceAction, align: 'right' }),
];
const row = new TableRow<InferenceServer>({ selectable: (_service): boolean => true });

let data: (InferenceServer & { selected?: boolean })[];

onMount(() => {
  return inferenceServers.subscribe(items => {
    data = items;
  });
});

let selectedItemsNumber: number;

const deleteSelected = (): void => {
  studioClient
    .requestDeleteInferenceServer(
      ...data.filter(service => service.selected).map(service => service.container.containerId),
    )
    .catch((err: unknown) => {
      console.error('Something went wrong while trying to delete inference server', err);
    });
};

function createNewService(): void {
  router.goto('/service/create');
}
</script>

<NavPage title="Model Services" searchEnabled={false}>
  <svelte:fragment slot="additional-actions">
    {#if selectedItemsNumber > 0}
      <Button title="Delete selected items" on:click={deleteSelected} icon={faTrash}
        >Delete {selectedItemsNumber} selected items</Button>
    {/if}
    <Button icon={faPlusCircle} title="Create a new model service" on:click={createNewService}
      >New Model Service</Button>
  </svelte:fragment>
  <svelte:fragment slot="content">
    <div class="flex min-w-full min-h-full">
      {#if data?.length > 0}
        <Table kind="service" data={data} columns={columns} row={row} bind:selectedItemsNumber={selectedItemsNumber} />
      {:else}
        <EmptyScreen
          icon={faRocket}
          title="No model service running"
          message="A model service offers a configurable endpoint via an OpenAI-compatible web server, facilitating a seamless integration of AI capabilities into existing applications. Upon initialization, effortlessly access detailed service information and generate code snippets in multiple programming languages to ease application integration.">
          <div class="flex gap-2 justify-center">
            <Button type="link" on:click={createNewService}>Create service</Button>
          </div>
        </EmptyScreen>
      {/if}
    </div>
  </svelte:fragment>
</NavPage>
