<script lang="ts">
import type { Task } from '@shared/src/models/ITask';
import ExpandableMessage from '/@/lib/ExpandableMessage.svelte';
import TaskItem from './TaskItem.svelte';

export let tasks: Task[] = [];
</script>

<ul class="space-y-2 text-gray-500 list-inside dark:text-gray-400">
  {#each tasks as task}
    <li class="flex flex-col rounded-md bg-charcoal-800 p-2">
      <TaskItem task="{task}" />
      <ExpandableMessage message="{task.error}" title="View Error" />
    </li>
  {/each}
</ul>
