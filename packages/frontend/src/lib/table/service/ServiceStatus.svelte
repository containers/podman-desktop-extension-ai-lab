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

let status: string;
let loading: boolean;
$: {
  status = getStatus();
  loading = object.health === undefined && object.status !== 'stopped';
}

function getStatus(): 'RUNNING' | 'STARTING' | 'DEGRADED' | '' {
  if (object.status === 'stopped') {
    return '';
  }

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
</script>

{#if loading}
  <Spinner />
{:else}
  <button on:click="{navigateToContainer}">
    <StatusIcon status="{status}" icon="{ContainerIcon}" />
  </button>
{/if}
