<script lang="ts">
import { faPlay, faRotateForward, faStop } from '@fortawesome/free-solid-svg-icons';
import ListItemButtonIcon from '/@/lib/button/ListItemButtonIcon.svelte';
import { studioClient } from '/@/utils/client';
import type { EnvironmentState } from '@shared/src/models/IEnvironmentState';
export let object: EnvironmentState | undefined;
export let recipeId: string;
export let modelId: string;

function stopEnvironment() {
  studioClient.requestRemoveEnvironment(recipeId, modelId).catch(err => {
    console.error(`Something went wrong while trying to stop AI App: ${String(err)}.`);
  });
}

function restartEnvironment() {
  studioClient.requestRestartEnvironment(recipeId, modelId).catch(err => {
    console.error(`Something went wrong while trying to restart AI App: ${String(err)}.`);
  });
}
</script>

{#if object?.pod !== undefined}
  <ListItemButtonIcon icon="{faStop}" onClick="{() => stopEnvironment()}" title="Stop AI App" />

  <ListItemButtonIcon icon="{faRotateForward}" onClick="{() => restartEnvironment()}" title="Restart AI App" />
{/if}
