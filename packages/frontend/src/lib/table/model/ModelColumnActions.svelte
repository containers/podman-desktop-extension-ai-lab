<script lang="ts">
import type { ModelInfo } from '@shared/src/models/IModelInfo';
import { faCircleArrowUp, faDownload, faRocket, faTrash } from '@fortawesome/free-solid-svg-icons';
import { faFolderOpen } from '@fortawesome/free-solid-svg-icons';
import ListItemButtonIcon from '../../button/ListItemButtonIcon.svelte';
import { studioClient } from '/@/utils/client';
import { router } from 'tinro';
import { modelsUpdateInfo } from '/@/stores/modelsUpdateInfo';
import type { UpdateInfo } from '@shared/src/models/IUpdate';
export let object: ModelInfo;

let updateInfo: UpdateInfo | undefined = undefined;
$: updateInfo = $modelsUpdateInfo.find(update => update.modelId === object.id);

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

function updateModel() {
  studioClient.requestModelUpdate(object.id).catch(err => {
    console.error('Something went wrong while trying to request model update', err);
  });
}
</script>

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
  <ListItemButtonIcon icon="{faDownload}" onClick="{downloadModel}" title="Download Model" enabled="{!object.state}" />
{/if}
{#if updateInfo}
  <ListItemButtonIcon icon="{faCircleArrowUp}" title="{updateInfo.message}" onClick="{() => updateModel()}" />
{/if}
