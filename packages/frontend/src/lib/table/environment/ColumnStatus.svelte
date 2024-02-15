<script lang="ts">
import type { Task } from '@shared/src/models/ITask';
import type { EnvironmentCell } from '/@/pages/environments';
import TaskItem from '../../progress/TaskItem.svelte';
export let object: EnvironmentCell;
let task: Task | undefined = undefined;

$: {
  if (object.tasks && object.tasks.length > 0) {
    task = object.tasks[object.tasks.length - 1];
  }
}
</script>

{#if task}
  <div class="text-sm text-gray-700">
    <TaskItem task="{task}" />
  </div>
{/if}
