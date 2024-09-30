<script lang="ts">
import type { Task } from '@shared/src/models/ITask';
import { filterByLabel } from '/@/utils/taskUtils';
import TasksProgress from '/@/lib/progress/TasksProgress.svelte';

interface Props {
  trackingId?: string;
  tasks: Task[],
  class?: string;
  onChange?: (tasks: Task[]) => void,
}
let { trackingId, tasks, onChange, class: classes }: Props = $props();

let trackedTasks: Task[] = $derived.by(() => {
  if (trackingId === undefined) {
    return [];
  }

  return filterByLabel(tasks, {
    trackingId: trackingId,
  });
});

$effect(() => {
  onChange?.($state.snapshot(trackedTasks));
});
</script>

{#if trackedTasks.length > 0}
  <div role="status" class={classes}>
    <TasksProgress tasks={trackedTasks} />
  </div>
{/if}

