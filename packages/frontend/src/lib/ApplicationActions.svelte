<script lang="ts">
import { faRotateForward, faArrowUpRightFromSquare, faTrash, faBookOpen } from '@fortawesome/free-solid-svg-icons';
import ListItemButtonIcon from '/@/lib/button/ListItemButtonIcon.svelte';
import { studioClient } from '/@/utils/client';
import type { ApplicationState } from '@shared/src/models/IApplicationState';
import { router } from 'tinro';
import DropDownMenu from './DropDownMenu.svelte';
import FlatMenu from './FlatMenu.svelte';
export let object: ApplicationState | undefined;
export let recipeId: string;
export let modelId: string;
export let dropdownMenu = false;
export let enableGoToRecipeAction = false;

function deleteApplication() {
  studioClient.requestRemoveApplication(recipeId, modelId).catch(err => {
    console.error(`Something went wrong while trying to delete AI App: ${String(err)}.`);
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

function redirectToRecipe() {
  router.goto(`/recipe/${recipeId}`);
}

let actionsStyle: typeof DropDownMenu | typeof FlatMenu;
if (dropdownMenu) {
  actionsStyle = DropDownMenu;
} else {
  actionsStyle = FlatMenu;
}
</script>

{#if object?.pod !== undefined}
  <ListItemButtonIcon icon="{faTrash}" onClick="{() => deleteApplication()}" title="Delete AI App" />

  <ListItemButtonIcon icon="{faArrowUpRightFromSquare}" onClick="{() => openApplication()}" title="Open AI App" />

  <svelte:component this="{actionsStyle}">
    <ListItemButtonIcon
      icon="{faRotateForward}"
      onClick="{() => restartApplication()}"
      title="Restart AI App"
      menu="{dropdownMenu}" />

    <ListItemButtonIcon
      icon="{faBookOpen}"
      onClick="{() => redirectToRecipe()}"
      title="Open Recipe"
      hidden="{!enableGoToRecipeAction}"
      menu="{dropdownMenu}" />
  </svelte:component>
{/if}
