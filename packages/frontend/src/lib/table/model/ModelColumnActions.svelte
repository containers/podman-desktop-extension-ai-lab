<script lang="ts">
import type { ModelInfo } from "@shared/src/models/IModelInfo";
import { faTrash } from "@fortawesome/free-solid-svg-icons";
import ListItemButtonIcon from "../../button/ListItemButtonIcon.svelte";
import { studioClient } from "/@/utils/client";
export let object: ModelInfo;

function deleteModel() {
  console.log('delete model', object.id);
  studioClient.deleteLocalModel(object.id);
}
</script>

<ListItemButtonIcon
  icon={faTrash}
  onClick={() => deleteModel()}
  title="Delete Model"
  enabled={!object.state}
/>
