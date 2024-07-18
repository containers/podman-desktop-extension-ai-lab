<script lang="ts">
import { tasks } from '/@/stores/tasks';
import type { Task } from '@shared/src/models/ITask';
import Card from '/@/lib/Card.svelte';
import TasksProgress from '/@/lib/progress/TasksProgress.svelte';
import { onMount } from 'svelte';

/**
 * labels that should be matching on tasks
 * @example
 * labels: { 'hello': undefined }
 * will match any tasks with the `hello` label, regardless of the value of the labels
 *
 * @example
 * labels: { 'hello': 'world' }
 * will match tasks with the `hello` label, and the `world` value
 */
export let labels: Record<string, string | undefined> = {};
export let title: string;

let loadingTasks: Task[] = [];

onMount(() => {
  const entries: [string, string | undefined][] = Object.entries(labels);
  return tasks.subscribe(items => {
    loadingTasks = items.reduce((output, task) => {
      // only display failed / loading tasks
      if (task.state === 'success') return output;

      const taskLabels = task.labels ?? {};
      for (const [key, value] of entries) {
        // ensure the label requested is in the task labels
        if (!(key in taskLabels)) return output;

        // if we defined a value for the label, remove any value not matching
        if (value && taskLabels[key] !== value) return output;
      }

      output.push(task);

      return output;
    }, [] as Task[]);
  });
});
</script>

{#if loadingTasks.length > 0}
  <Card classes="bg-[var(--pd-content-card-bg)] mt-4 mx-5">
    <div slot="content" class="text-base font-normal p-2 w-full">
      <div class="text-base mb-2 text-[var(--pd-content-card-title)]">{title}</div>
      <TasksProgress tasks={loadingTasks} />
    </div>
  </Card>
{/if}
