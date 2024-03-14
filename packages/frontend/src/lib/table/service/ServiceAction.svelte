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
  studioClient.deleteInferenceServer(object.container.containerId).catch((err: unknown) => {
    console.error('Something went wrong while trying to delete inference server', err);
  });
}
</script>

{#if object.status === 'running' || object.status === 'stopping'}
  <ListItemButtonIcon
    enabled="{object.status === 'running'}"
    icon="{faStop}"
    onClick="{stopInferenceServer}"
    title="Stop container" />
{:else if object.status === 'stopped' || object.status === 'starting'}
  <ListItemButtonIcon
    enabled="{object.status === 'stopped'}"
    icon="{faPlay}"
    onClick="{startInferenceServer}"
    title="Start container" />
{/if}
<ListItemButtonIcon
  enabled="{object.status !== 'deleting'}"
  icon="{faTrash}"
  onClick="{deleteInferenceServer}"
  title="Delete service" />
