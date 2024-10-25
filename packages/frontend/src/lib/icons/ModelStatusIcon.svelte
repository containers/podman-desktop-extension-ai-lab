<script lang="ts">
import type { ModelInfo } from '@shared/src/models/IModelInfo';
import ModelWhite from './ModelWhite.svelte';
import { inferenceServers } from '/@/stores/inferenceServers';

import { StatusIcon } from '@podman-desktop/ui-svelte';
import RemoteModel from './RemoteModel.svelte';

interface Props {
  object: ModelInfo;
}

let { object }: Props = $props();

let status: string | undefined = $derived.by(() => {
  if ($inferenceServers.some(server => server.models.some(model => model.id === object.id))) {
    return 'USED';
  } else {
    return object.file ? 'DOWNLOADED' : 'NONE';
  }
});
</script>

{#if status === 'NONE'}
  <div role="status" title="NONE">
    <RemoteModel class="text-[var(--pd-status-not-running)]" size='28' />
  </div>
{:else}
  <StatusIcon status={status} icon={ModelWhite} />
{/if}
