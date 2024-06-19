<script lang="ts">
import type { InferenceServer } from '@shared/src/models/IInference';
import ServiceColumnName from '/@/lib/table/service/ServiceColumnName.svelte';
import { inferenceServers } from '/@/stores/inferenceServers';
import ServiceStatus from '/@/lib/table/service/ServiceStatus.svelte';
import ServiceAction from '/@/lib/table/service/ServiceAction.svelte';
import ServiceColumnModelName from '/@/lib/table/service/ServiceColumnModelName.svelte';
import { faTrash } from '@fortawesome/free-solid-svg-icons';
import { studioClient } from '/@/utils/client';
import { router } from 'tinro';
import { onMount } from 'svelte';
import { Button } from '@podman-desktop/ui-svelte';
import { Table, TableColumn, TableRow, NavPage } from '@podman-desktop/ui-svelte';

const columns: TableColumn<InferenceServer>[] = [
  new TableColumn<InferenceServer>('Status', { width: '70px', renderer: ServiceStatus, align: 'center' }),
  new TableColumn<InferenceServer>('Name', { width: '1fr', renderer: ServiceColumnName, align: 'left' }),
  new TableColumn<InferenceServer>('Model', { renderer: ServiceColumnModelName, align: 'left' }),
  new TableColumn<InferenceServer>('Actions', { width: '80px', renderer: ServiceAction, align: 'right' }),
];
const row = new TableRow<InferenceServer>({ selectable: _service => true });

let data: (InferenceServer & { selected?: boolean })[];

onMount(() => {
  return inferenceServers.subscribe(items => {
    data = items;
  });
});

let selectedItemsNumber: number;

const deleteSelected = () => {
  studioClient
    .requestDeleteInferenceServer(
      ...data.filter(service => service.selected).map(service => service.container.containerId),
    )
    .catch((err: unknown) => {
      console.error('Something went wrong while trying to delete inference server', err);
    });
};

function createNewService() {
  router.goto('/service/create');
}
</script>

<NavPage title="Model Services" searchEnabled="{false}">
  <svelte:fragment slot="additional-actions">
    {#if selectedItemsNumber > 0}
      <Button title="Delete selected items" on:click="{deleteSelected}" icon="{faTrash}"
        >Delete {selectedItemsNumber} selected items</Button>
    {/if}
    <Button title="Create a new model service" on:click="{() => createNewService()}">New Model Service</Button>
  </svelte:fragment>
  <svelte:fragment slot="content">
    <div slot="content" class="flex flex-col min-w-full min-h-full">
      <div class="min-w-full min-h-full flex-1">
        <div class="mt-4 px-5 space-y-5">
          {#if data?.length > 0}
            <Table
              kind="service"
              data="{data}"
              columns="{columns}"
              row="{row}"
              bind:selectedItemsNumber="{selectedItemsNumber}" />
          {:else}
            <div role="status">
              There is no model service. You can <a
                href="{'javascript:void(0);'}"
                class="underline"
                role="button"
                title="Create a new Model Service"
                on:click="{createNewService}">create one now</a
              >.
            </div>
            <p>
              A model service offers a configurable endpoint via an OpenAI-compatible web server, facilitating a
              seamless integration of AI capabilities into existing applications. Upon initialization, effortlessly
              access detailed service information and generate code snippets in multiple programming languages to ease
              application integration.
            </p>
          {/if}
        </div>
      </div>
    </div>
  </svelte:fragment>
</NavPage>
