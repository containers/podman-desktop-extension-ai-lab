<script lang="ts">
import { faRotateForward, faTrash } from "@fortawesome/free-solid-svg-icons";
import ListItemButtonIcon from "../../button/ListItemButtonIcon.svelte";
import { studioClient } from "/@/utils/client";
import type { EnvironmentState } from "@shared/src/models/IEnvironmentState";
export let object: EnvironmentState;

function deleteEnvironment() {
  studioClient.requestRemoveEnvironment(object.recipeId).catch((err) => {
    console.error(`Something went wrong while trying to stop environment: ${String(err)}.`);
  });
}

function restartEnvironment() {
  studioClient.requestRestartEnvironment(object.recipeId).catch((err) => {
    console.error(`Something went wrong while trying to restart environment: ${String(err)}.`);
  });
}
</script>

<ListItemButtonIcon
  icon={faTrash}
  onClick={() => deleteEnvironment()}
  title="Delete Environment"
  inProgress={object.status === 'stopping' || object.status === 'removing'}
/>

<ListItemButtonIcon
  icon={faRotateForward}
  onClick={() => restartEnvironment()}
  title="Restart Environment"
  enabled={object.status !== 'stopping' && object.status !== 'removing'}
/>
