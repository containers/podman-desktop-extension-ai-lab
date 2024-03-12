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
</script>

{#if object.status === 'running'}
  <ListItemButtonIcon icon="{faStop}" onClick="{stopInferenceServer}" title="Stop container" />
{:else}
  <ListItemButtonIcon icon="{faPlay}" onClick="{startInferenceServer}" title="Start container" />
{/if}
