<script lang="ts">
import { getApplicationStatus } from '../../../pages/applications';
import type { ApplicationState } from '@shared/src/models/IApplicationState';
import PodIcon from '../../images/PodIcon.svelte';
import { Spinner, StatusIcon } from '@podman-desktop/ui-svelte';

export let object: ApplicationState;

let status: string;
$: status = getApplicationStatus(object);
</script>

{#if status === 'STARTING'}
  <Spinner class="text-[var(--pd-table-body-text-highlight)]" />
{:else}
  <StatusIcon size={22} status={status} icon={PodIcon} />
{/if}
