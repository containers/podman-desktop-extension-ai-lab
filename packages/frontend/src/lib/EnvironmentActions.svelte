<script lang="ts">
import { faPlay, faRotateForward, faStop } from '@fortawesome/free-solid-svg-icons';
import ListItemButtonIcon from '/@/lib/button/ListItemButtonIcon.svelte';
import { studioClient } from '/@/utils/client';
import type { EnvironmentState } from '@shared/src/models/IEnvironmentState';
import type { Task } from '@shared/src/models/ITask';
export let object: EnvironmentState | undefined;
export let recipeId: string;
export let modelId: string;
export let tasks: Task[] | undefined;

$: runningTask = tasks && !!tasks.find(t => t.state === 'loading');

function startEnvironment() {
  studioClient.pullApplication(recipeId, modelId).catch((err: unknown) => {
    console.error('Something went wrong while pulling application', err);
  });
}

function stopEnvironment() {
  studioClient.requestRemoveEnvironment(recipeId, modelId).catch(err => {
    console.error(`Something went wrong while trying to stop environment: ${String(err)}.`);
  });
}

function restartEnvironment() {
  studioClient.requestRestartEnvironment(recipeId, modelId).catch(err => {
    console.error(`Something went wrong while trying to restart environment: ${String(err)}.`);
  });
}
</script>

<ListItemButtonIcon
  icon="{faPlay}"
  onClick="{() => startEnvironment()}"
  title="Start Environment"
  enabled="{(!object?.pod || object?.pod.Status !== 'Running') && !runningTask}" />

<ListItemButtonIcon
  icon="{faStop}"
  onClick="{() => stopEnvironment()}"
  title="Stop Environment"
  enabled="{object?.pod.Status === 'Running'}" />

<ListItemButtonIcon
  icon="{faRotateForward}"
  onClick="{() => restartEnvironment()}"
  title="Restart Environment"
  enabled="{object?.pod.Status === 'Running'}" />
