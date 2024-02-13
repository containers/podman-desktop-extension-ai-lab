<script lang="ts">
import type { ModelInfo } from '@shared/src/models/IModelInfo';
import { faTrash } from '@fortawesome/free-solid-svg-icons';
import { faFolderOpen } from '@fortawesome/free-solid-svg-icons';
import ListItemButtonIcon from '../../button/ListItemButtonIcon.svelte';
import { studioClient } from '/@/utils/client';
export let object: ModelInfo;

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
</script>

<ListItemButtonIcon
  icon="{faFolderOpen}"
  onClick="{() => openModelFolder()}"
  title="Open Model Folder"
  enabled="{object.file !== undefined && !object.state}" />
<ListItemButtonIcon
  icon="{faTrash}"
  onClick="{() => deleteModel()}"
  title="Delete Model"
  enabled="{object.file !== undefined && !object.state}" />
