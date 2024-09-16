<script lang="ts">
import Fa from 'svelte-fa';
import { faTriangleExclamation } from '@fortawesome/free-solid-svg-icons';
import { Button } from '@podman-desktop/ui-svelte';
import { studioClient } from '/@/utils/client';

const actionName = 'Create GPU enabled machine';

function executeCommand(): void {
  studioClient.navigateToResources().catch(err => console.error('Error navigating to resources', err));
}
</script>

<div
  class="w-full bg-[var(--pd-content-card-bg)] text-[var(--pd-content-card-text)] border-t-[3px] border-amber-500 p-4 mt-5 shadow-inner"
  aria-label="GPU machine banner">
  <div class="flex flex-row space-x-3">
    <div class="flex">
      <Fa icon={faTriangleExclamation} class="text-amber-400" />
    </div>
    <div class="flex flex-col grow">
      <span class="font-medium" aria-label="title">Non GPU enabled machine</span>
      <span aria-label="description"
        >The selected Podman machine is not GPU enabled. On MacOS, you can run GPU workloads using the krunkit
        environment. Do you want to create a GPU enabled machine ?</span>
    </div>
    <div class="flex items-center">
      <Button class="grow text-gray-500" on:click={executeCommand} aria-label={actionName}>{actionName}</Button>
    </div>
  </div>
</div>
