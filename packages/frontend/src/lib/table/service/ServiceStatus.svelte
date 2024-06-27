<script lang="ts">
import type { InferenceServerInfo } from '@shared/src/models/IInference';
import StatusIcon from '/@/lib/StatusIcon.svelte';
import { studioClient } from '/@/utils/client';
import { Spinner } from '@podman-desktop/ui-svelte';
import { ContainerIcon } from '@podman-desktop/ui-svelte/icons';
import { RuntimeType } from '@shared/src/models/IInference.js';
import PodIcon from '/@/lib/images/PodIcon.svelte';
export let object: InferenceServerInfo;

function navigateToContainer() {
  studioClient.navigateToServer(object.id);
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
  <Spinner />
{:else}
  <button on:click="{navigateToContainer}">
    <StatusIcon status="{status}" icon="{object.runtime === RuntimeType.PODMAN ? ContainerIcon : PodIcon}" />
  </button>
{/if}
