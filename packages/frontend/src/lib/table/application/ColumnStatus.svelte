<script lang="ts">
import { getApplicationStatus } from '../../../pages/applications';
import type { ApplicationState } from '@shared/src/models/IApplicationState';
import StatusIcon from '../../StatusIcon.svelte';
import PodIcon from '../../images/PodIcon.svelte';
import Spinner from '../../button/Spinner.svelte';
export let object: ApplicationState;

$: status = getApplicationStatus(object);
</script>

{#if status === 'STARTING'}
  <Spinner />
{:else}
  <StatusIcon size="{22}" status="{status}" icon="{PodIcon}" />
{/if}
