<script lang="ts">
import type { InferenceServer } from '@shared/src/models/IInference';
import { studioClient } from '/@/utils/client';
import { Spinner, StatusIcon } from '@podman-desktop/ui-svelte';
import { ContainerIcon } from '@podman-desktop/ui-svelte/icons';

export let object: InferenceServer;

function navigateToContainer() {
  studioClient.navigateToContainer(object.container.containerId);
}

let status: string;
let loading: boolean;
$: {
  status = getStatus();
  loading = ['deleting', 'stopping', 'starting'].includes(object.status);
}

function getStatus(): 'RUNNING' | 'STARTING' | 'DEGRADED' | '' {
  switch (object.status) {
    case 'stopped':
      return '';
    case 'error':
      return 'DEGRADED';
    default:
      break;
  }

  // Special case: when the health check is undefined, and the container is running
  // it is not ready, so still showing starting
  if (object.health === undefined && object.status === 'running') {
    return 'STARTING';
  }

  switch (object.health?.Status) {
    case 'healthy':
      return 'RUNNING';
    case 'unhealthy':
    case 'error':
      return 'DEGRADED';
    case 'starting':
      return 'STARTING';
    default:
      return '';
  }
}
</script>

{#if loading}
  <Spinner class="text-[var(--pd-table-body-text-highlight)]" />
{:else}
  <button on:click={navigateToContainer}>
    <StatusIcon status={status} icon={ContainerIcon} />
  </button>
{/if}
