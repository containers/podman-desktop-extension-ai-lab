<script lang="ts">
import { faPlay, faRotateForward, faTrash } from '@fortawesome/free-solid-svg-icons';
import ListItemButtonIcon from '/@/lib/button/ListItemButtonIcon.svelte';
import { studioClient } from '/@/utils/client';
import type { EnvironmentState } from '@shared/src/models/IEnvironmentState';
import type { Task } from '@shared/src/models/ITask';
export let object: EnvironmentState | undefined;
export let recipeId: string;
export let tasks: Task[] | undefined;

$: runningTask = tasks && !!tasks.find(t => t.state === 'loading');

function startEnvironment() {
  studioClient.pullApplication(recipeId).catch((err: unknown) => {
    console.error('Something went wrong while pulling application', err);
  });
}

function deleteEnvironment() {
  studioClient.requestRemoveEnvironment(recipeId).catch(err => {
    console.error(`Something went wrong while trying to stop environment: ${String(err)}.`);
  });
}

function restartEnvironment() {
  studioClient.requestRestartEnvironment(recipeId).catch(err => {
    console.error(`Something went wrong while trying to restart environment: ${String(err)}.`);
  });
}
</script>

<ListItemButtonIcon
  icon="{faPlay}"
  onClick="{() => startEnvironment()}"
  title="Start Environment"
  enabled="{!object?.pod && !runningTask}" />

<ListItemButtonIcon
  icon="{faTrash}"
  onClick="{() => deleteEnvironment()}"
  title="Delete Environment"
  enabled="{!!object?.pod}" />

<ListItemButtonIcon
  icon="{faRotateForward}"
  onClick="{() => restartEnvironment()}"
  title="Restart Environment"
  enabled="{!!object?.pod}" />
