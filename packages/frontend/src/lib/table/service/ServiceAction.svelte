<script lang="ts">
  import { type InferenceServerInfo, RuntimeType } from '@shared/src/models/IInference';
import { studioClient } from '/@/utils/client';
import { faPlay, faStop, faTrash } from '@fortawesome/free-solid-svg-icons';
import ListItemButtonIcon from '/@/lib/button/ListItemButtonIcon.svelte';
export let object: InferenceServerInfo;
export let detailed: boolean = false;

function stopInferenceServer() {
  studioClient.stopInferenceServer(object.id).catch((err: unknown) => {
    console.error('Something went wrong while trying to stop inference server', err);
  });
}

function startInferenceServer() {
  studioClient.startInferenceServer(object.id).catch((err: unknown) => {
    console.error('Something went wrong while trying to start inference server', err);
  });
}

function deleteInferenceServer() {
  studioClient.requestDeleteInferenceServer(object.id).catch((err: unknown) => {
    console.error('Something went wrong while trying to delete inference server', err);
  });
}

let loading: boolean;
$: {
  loading = ['deleting', 'stopping', 'starting'].includes(object.status);
}
</script>

{#if object.runtime === RuntimeType.PODMAN}
  {#if object.status === 'running'}
    <ListItemButtonIcon detailed="{detailed}" icon="{faStop}" onClick="{stopInferenceServer}" title="Stop service" />
  {:else}
    <ListItemButtonIcon
      detailed="{detailed}"
      enabled="{!loading}"
      icon="{faPlay}"
      onClick="{startInferenceServer}"
      title="Start service" />
  {/if}
{/if}
<ListItemButtonIcon
  detailed="{detailed}"
  enabled="{!loading}"
  icon="{faTrash}"
  onClick="{deleteInferenceServer}"
  title="Delete service" />
