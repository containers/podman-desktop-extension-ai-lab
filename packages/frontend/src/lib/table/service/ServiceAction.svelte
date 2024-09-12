<script lang="ts">
import type { InferenceServer } from '@shared/src/models/IInference';
import { studioClient } from '/@/utils/client';
import { faPlay, faStop, faTrash } from '@fortawesome/free-solid-svg-icons';
import ListItemButtonIcon from '/@/lib/button/ListItemButtonIcon.svelte';

export let object: InferenceServer;
export let detailed: boolean = false;

function stopInferenceServer(): void {
  studioClient.stopInferenceServer(object.container.containerId).catch((err: unknown) => {
    console.error('Something went wrong while trying to stop inference server', err);
  });
}

function startInferenceServer(): void {
  studioClient.startInferenceServer(object.container.containerId).catch((err: unknown) => {
    console.error('Something went wrong while trying to start inference server', err);
  });
}

function deleteInferenceServer(): void {
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
  <ListItemButtonIcon detailed={detailed} icon={faStop} onClick={stopInferenceServer} title="Stop service" />
{:else}
  <ListItemButtonIcon
    detailed={detailed}
    enabled={!loading}
    icon={faPlay}
    onClick={startInferenceServer}
    title="Start service" />
{/if}
<ListItemButtonIcon
  detailed={detailed}
  enabled={!loading}
  icon={faTrash}
  onClick={deleteInferenceServer}
  title="Delete service" />
