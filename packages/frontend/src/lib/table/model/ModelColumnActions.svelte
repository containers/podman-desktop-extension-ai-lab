<script lang="ts">
import type { ModelInfo } from "@shared/src/models/IModelInfo";
import { faTrash } from "@fortawesome/free-solid-svg-icons";
import { faFolderOpen } from "@fortawesome/free-solid-svg-icons";
import ListItemButtonIcon from "../../button/ListItemButtonIcon.svelte";
import { studioClient } from "/@/utils/client";
import Modal from "../../Modal.svelte";
import Button from "../../button/Button.svelte";
export let object: ModelInfo;

let deleteConfirmVisible: boolean = false;

function deleteModel() {
  deleteConfirmVisible= true;
}

async function goDeleteModel() {
  await studioClient.deleteLocalModel(object.id);
  deleteConfirmVisible= false;
}

function openModelFolder() {
  if (object && object.file) {
    studioClient.openFile(object.file.path);
  }
}
</script>

<ListItemButtonIcon
  icon={faFolderOpen}
  onClick={() => openModelFolder()}
  title="Open Model Folder"
/>
<ListItemButtonIcon
  icon={faTrash}
  onClick={() => deleteModel()}
  title="Delete Model"
  enabled={!object.state}
/>

{#if deleteConfirmVisible}
  <Modal
    on:close="{() => {
      deleteConfirmVisible = false;
    }}">
    <div class="flex items-center justify-between bg-black px-5 py-4 border-b-2 border-violet-700">
      <h1 class="text-xl font-bold">Delete a model</h1>

      <button class="hover:text-gray-300 px-2 py-1" on:click="{() => deleteConfirmVisible = false}">
        <i class="fas fa-times" aria-hidden="true"></i>
      </button>
    </div>
    <div class="bg-charcoal-600 p-5 h-full flex flex-col justify-items-center">
      <span class="pb-3">The folder on disk containing the model will be deleted, it contains:</span>
      <ul class="list-disc ml-8 space-y-2">
        <li>{object.file?.file}</li>
      </ul>

      <div class="pt-5 grid grid-cols-2 gap-10 place-content-center w-full">
        <Button type="primary" on:click="{() => goDeleteModel()}">Delete</Button>
        <Button type="secondary" on:click="{() => deleteConfirmVisible = false}">Cancel</Button>
      </div>
    </div>
  </Modal>
{/if}
