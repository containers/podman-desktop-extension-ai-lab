<script lang="ts">
import type { InferenceServer } from '@shared/src/models/IInference';
import { studioClient } from '/@/utils/client';
import { faPlay, faStop, faTrash } from '@fortawesome/free-solid-svg-icons';
import ListItemButtonIcon from '/@/lib/button/ListItemButtonIcon.svelte';
export let object: InferenceServer;

function stopInferenceServer() {
  studioClient.stopInferenceServer(object.container.containerId);
}

function startInferenceServer() {
  studioClient.startInferenceServer(object.container.containerId);
}

function deleteInferenceServer() {
  alert('not implemented');
}
</script>

{#key object.status}
  {#if object.status === 'running'}
    <ListItemButtonIcon icon="{faStop}" onClick="{stopInferenceServer}" title="Stop container" />
  {:else}
    <ListItemButtonIcon icon="{faPlay}" onClick="{startInferenceServer}" title="Start container" />
    <ListItemButtonIcon icon="{faTrash}" onClick="{deleteInferenceServer}" title="Delete container" />
  {/if}
{/key}
