<script lang="ts">
import { faDownload, faRocket, faTrash } from '@fortawesome/free-solid-svg-icons';
import { faFolderOpen } from '@fortawesome/free-solid-svg-icons';
import ListItemButtonIcon from '../../button/ListItemButtonIcon.svelte';
import { studioClient } from '/@/utils/client';
import { router } from 'tinro';
import type { ModelInfoUI } from '/@/models/ModelInfoUI';
import ErrorMessage from '../../ErrorMessage.svelte';
import { onMount } from 'svelte';
export let object: ModelInfoUI;

function deleteModel() {
  studioClient.requestRemoveLocalModel(object.id).catch(err => {
    console.error(`Something went wrong while trying to delete model ${String(err)}.`);
  });
}

function openModelFolder() {
  if (object && object.file) {
    studioClient.openFile(object.file.path);
  }
}

function downloadModel() {
  if (object && object.file === undefined) {
    studioClient.downloadModel(object.id).catch((err: unknown) => {
      console.error(`Something went wrong while trying to download model ${object.id}`, err);
    });
  }
}

function createModelService() {
  router.goto('/service/create');
  router.location.query.replace({ 'model-id': object.id });
}

let container: HTMLDivElement;
let bottomHalf = false;
onMount(() => {
  // if the row is below half page, we move the tooltip position of the error message
  const bcr = container.getBoundingClientRect();
  bottomHalf = bcr.top > window.innerHeight / 2;
});
</script>

<div class="flex w-full" bind:this="{container}">
  <div class="flex items-center w-5">
    {#if object.actionError}
      <ErrorMessage
        error="{object.actionError}"
        icon
        tooltipPosition="{bottomHalf ? 'topLeft' : 'bottomLeft'}"
        tooltipClass="text-pretty w-64" />
    {:else}
      <div>&nbsp;</div>
    {/if}
  </div>
  <div class="text-right w-full">
    {#if object.file !== undefined}
      <ListItemButtonIcon
        icon="{faRocket}"
        title="Create Model Service"
        enabled="{!object.state}"
        onClick="{() => createModelService()}" />
      <ListItemButtonIcon
        icon="{faFolderOpen}"
        onClick="{() => openModelFolder()}"
        title="Open Model Folder"
        enabled="{!object.state}" />
      <ListItemButtonIcon icon="{faTrash}" onClick="{deleteModel}" title="Delete Model" enabled="{!object.state}" />
    {:else}
      <ListItemButtonIcon
        icon="{faDownload}"
        onClick="{downloadModel}"
        title="Download Model"
        enabled="{!object.state}" />
    {/if}
  </div>
</div>
