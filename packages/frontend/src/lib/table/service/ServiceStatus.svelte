<script lang="ts">
import type { InferenceServer } from '@shared/src/models/IInference';
import StatusIcon from '/@/lib/StatusIcon.svelte';
import ContainerIcon from '/@/lib/images/ContainerIcon.svelte';
import { studioClient } from '/@/utils/client';
import Spinner from '/@/lib/button/Spinner.svelte';
export let object: InferenceServer;

function navigateToContainer() {
  studioClient.navigateToContainer(object.container.containerId);
}

function getStatus(): 'RUNNING' | 'STARTING' | 'DEGRADED' | '' {
  if (object.status === 'stopped') {
    return '';
  }

  if(object.status === 'error')
    return 'DEGRADED';

  switch (object.health?.Status) {
    case 'healthy':
      return 'RUNNING';
    case 'unhealthy':
      return 'DEGRADED';
    case 'starting':
      return 'STARTING';
    default:
      return '';
  }
}

function isLoading(): boolean {
  switch (object.status) {
    case "deleting":
    case "stopping":
    case "starting":
      return true;
  }
  return object.health === undefined && object.status !== 'stopped';
}
</script>

{#key object.status}
  {#if isLoading()}
    <Spinner />
  {:else}
    <button on:click="{navigateToContainer}">
      <StatusIcon status="{getStatus()}" icon="{ContainerIcon}" />
    </button>
  {/if}
{/key}
