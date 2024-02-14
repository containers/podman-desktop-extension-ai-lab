<script lang="ts">
import TasksProgress from '../../progress/TasksProgress.svelte';
import type { EnvironmentCell } from '/@/pages/environments';
export let object: EnvironmentCell;
</script>

<div class="text-sm text-gray-700">
  <TasksProgress mini={true} tasks="{object.tasks}" />
</div>
