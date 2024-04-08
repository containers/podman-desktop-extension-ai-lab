<script lang="ts">
import { faRotateForward, faArrowUpRightFromSquare, faTrash } from '@fortawesome/free-solid-svg-icons';
import ListItemButtonIcon from '/@/lib/button/ListItemButtonIcon.svelte';
import { studioClient } from '/@/utils/client';
import type { ApplicationState } from '@shared/src/models/IApplicationState';
export let object: ApplicationState | undefined;
export let recipeId: string;
export let modelId: string;

function deleteApplication() {
  studioClient.requestRemoveApplication(recipeId, modelId).catch(err => {
    console.error(`Something went wrong while trying to stop AI App: ${String(err)}.`);
  });
}

function restartApplication() {
  studioClient.requestRestartApplication(recipeId, modelId).catch(err => {
    console.error(`Something went wrong while trying to restart AI App: ${String(err)}.`);
  });
}

function openApplication() {
  studioClient.requestOpenApplication(recipeId, modelId).catch(err => {
    console.error(`Something went wrong while trying to open AI App: ${String(err)}.`);
  });
}
</script>

{#if object?.pod !== undefined}
  <ListItemButtonIcon icon="{faTrash}" onClick="{() => deleteApplication()}" title="Delete AI App" />

  <ListItemButtonIcon icon="{faArrowUpRightFromSquare}" onClick="{() => openApplication()}" title="Open AI App" />

  <ListItemButtonIcon icon="{faRotateForward}" onClick="{() => restartApplication()}" title="Restart AI App" />
{/if}
