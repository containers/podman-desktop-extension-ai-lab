<script lang="ts">
import type { Task } from '@shared/src/models/ITask';
import ExpandableMessage from '/@/lib/ExpandableMessage.svelte';
import TaskItem from './TaskItem.svelte';

export let tasks: Task[] = [];
</script>

<ul class="space-y-2 text-[var(--pd-content-card-text)] list-inside">
  {#each tasks as task (task.id)}
    <li class="flex flex-col rounded-md bg-[var(--pd-content-card-bg)] p-2">
      <TaskItem task={task} />
      <ExpandableMessage message={task.error} title="View Error" />
    </li>
  {/each}
</ul>
