<script lang="ts">
import type { Task } from '@shared/src/models/ITask';
import type { ApplicationCell } from '../../../pages/applications';
import TaskItem from '../../progress/TaskItem.svelte';
export let object: ApplicationCell;
let task: Task | undefined = undefined;

$: {
  if (object.tasks && object.tasks.length > 0) {
    task = object.tasks[object.tasks.length - 1];
  }
}
</script>

<div class="text-sm text-gray-700 overflow-hidden text-ellipsis">
  {#if task}
    <TaskItem task="{task}" />
  {:else if !!object.envState.pod}
    Pod running
  {/if}
</div>
