<script lang="ts">
import type { InferenceServer } from '@shared/src/models/IInference';
import { studioClient } from '/@/utils/client';
import { faPlay, faStop, faTrash } from '@fortawesome/free-solid-svg-icons';
import ListItemButtonIcon from '/@/lib/button/ListItemButtonIcon.svelte';
export let object: InferenceServer;

function stopInferenceServer() {
  studioClient.stopInferenceServer(object.container.containerId).catch((err: unknown) => {
    console.error('Something went wrong while trying to stop inference server', err);
  });
}

function startInferenceServer() {
  studioClient.startInferenceServer(object.container.containerId).catch((err: unknown) => {
    console.error('Something went wrong while trying to start inference server', err);
  });
}

function deleteInferenceServer() {
  studioClient.requestDeleteInferenceServer(object.container.containerId).catch((err: unknown) => {
    console.error('Something went wrong while trying to delete inference server', err);
  });
}

let loading: boolean;
$: {
  loading = ['deleting', 'stopping', 'starting'].includes(object.status);
}
</script>

{#if object.status === 'running'}
  <ListItemButtonIcon icon="{faStop}" onClick="{stopInferenceServer}" title="Stop service" />
{:else}
  <ListItemButtonIcon enabled="{!loading}" icon="{faPlay}" onClick="{startInferenceServer}" title="Start service" />
{/if}
<ListItemButtonIcon enabled="{!loading}" icon="{faTrash}" onClick="{deleteInferenceServer}" title="Delete service" />
