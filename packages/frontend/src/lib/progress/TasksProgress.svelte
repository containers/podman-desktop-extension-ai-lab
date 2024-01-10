<script lang="ts">
  import type { Task } from '@shared/models/ITask';
  import Spinner from '/@/lib/progress/Spinner.svelte';

  export let tasks: Task[] = [];
</script>

<ul class="max-w-md space-y-2 text-gray-500 list-inside dark:text-gray-400">

  {#each tasks as task}
    <li class="flex items-center">
      {#if task.state === 'success'}
        <svg class="w-4 h-4 me-2 text-green-500 dark:text-green-400 flex-shrink-0" aria-hidden="true" xmlns="http://www.w3.org/2000/svg" fill="currentColor" viewBox="0 0 20 20">
          <path d="M10 .5a9.5 9.5 0 1 0 9.5 9.5A9.51 9.51 0 0 0 10 .5Zm3.707 8.207-4 4a1 1 0 0 1-1.414 0l-2-2a1 1 0 0 1 1.414-1.414L9 10.586l3.293-3.293a1 1 0 0 1 1.414 1.414Z"/>
        </svg>
      {:else if task.state === 'loading'}
        <Spinner/>
      {:else}
        <svg class="flex-shrink-0 inline w-4 h-4 me-3 text-red-600fe" aria-hidden="true" xmlns="http://www.w3.org/2000/svg" fill="currentColor" viewBox="0 0 20 20">
          <path d="M10 .5a9.5 9.5 0 1 0 9.5 9.5A9.51 9.51 0 0 0 10 .5ZM9.5 4a1.5 1.5 0 1 1 0 3 1.5 1.5 0 0 1 0-3ZM12 15H8a1 1 0 0 1 0-2h1v-3H8a1 1 0 0 1 0-2h2a1 1 0 0 1 1 1v4h1a1 1 0 0 1 0 2Z"/>
        </svg>
      {/if}
      {task.name}
    </li>
  {/each}
</ul>
