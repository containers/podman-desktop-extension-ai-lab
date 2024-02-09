<script lang="ts">
import { faTrash } from "@fortawesome/free-solid-svg-icons";
import ListItemButtonIcon from "../../button/ListItemButtonIcon.svelte";
import { studioClient } from "/@/utils/client";
import type { EnvironmentState } from "@shared/src/models/IEnvironmentState";
export let object: EnvironmentState;

function deleteEnvironment() {
  studioClient.requestRemoveEnvironment(object.recipeId).catch((err) => {
    console.error(`Something went wrong while trying to stop environment: ${String(err)}.`);
  });
}

</script>

<ListItemButtonIcon
  icon={faTrash}
  onClick={() => deleteEnvironment()}
  title="Delete Environment"
/>
