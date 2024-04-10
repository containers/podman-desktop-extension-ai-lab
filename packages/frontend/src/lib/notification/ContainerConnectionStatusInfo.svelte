<script lang="ts">
import Fa from 'svelte-fa';
import { faCircleExclamation } from '@fortawesome/free-solid-svg-icons';
import Button from '../button/Button.svelte';
import { filesize } from 'filesize';
import { studioClient } from '/@/utils/client';
import type { ContainerConnectionInfo } from '@shared/src/models/IContainerConnectionInfo';

export let connectionInfo: ContainerConnectionInfo;
type BannerBackgroundColor = 'light' | 'dark';
export let background: BannerBackgroundColor = 'light';

let title: string | undefined = '';
let description: string | undefined = '';
let actionName: string | undefined = '';
$: updateTitleDescription(connectionInfo);

function updateTitleDescription(connectionInfo: ContainerConnectionInfo) {
  if (connectionInfo.status === 'no-machine') {
    title = 'No Podman machine is running';
    description = 'Please start a Podman Machine before proceeding further.';
    actionName = connectionInfo.canRedirect ? 'Start now' : undefined;
    return;
  }

  if (connectionInfo.status === 'low-resources') {
    title = 'Upgrade your Podman machine for best AI performance';

    const hasEnoughCPU = connectionInfo.cpus >= connectionInfo.cpusExpected;
    const hasEnoughMemory = connectionInfo.memoryIdle > connectionInfo.memoryExpected;

    let machineCurrentStateDescription = '';
    let machinePreferredStateDescription = '';
    if (hasEnoughCPU) {
      machineCurrentStateDescription += `${connectionInfo.cpus} vCPUs`;
      machinePreferredStateDescription += `${connectionInfo.cpusExpected} vCPUs`;
      if (!hasEnoughMemory) {
        machineCurrentStateDescription += ` and ${filesize(connectionInfo.memoryIdle, { base: 2 })} of memory available`;
        machinePreferredStateDescription += ` and ${filesize(connectionInfo.memoryExpected, { base: 2 })} of memory`;
      }
    } else {
      machineCurrentStateDescription += `${filesize(connectionInfo.memoryIdle, { base: 2 })} of memory available`;
      machinePreferredStateDescription += `${filesize(connectionInfo.memoryExpected, { base: 2 })} of memory`;
    }

    const machineName = `${connectionInfo.name.includes('Podman Machine') ? connectionInfo.name : `Podman Machine ${connectionInfo.name}`}`;
    description = `Your ${machineName} has ${machineCurrentStateDescription}. `;

    if (connectionInfo?.canEdit) {
      description += `We recommend upgrading your Podman machine with at least ${machinePreferredStateDescription} for better AI performance.`;
      actionName = connectionInfo.canRedirect ? 'Upgrade now' : undefined;
    } else {
      description += `We recommend freeing some resources on your Podman machine to have at least ${machinePreferredStateDescription} for better AI performance.`;
    }
    return;
  }

  title = undefined;
  description = undefined;
  actionName = undefined;
}

function executeCommand() {
  if (connectionInfo.canRedirect) {
    if (connectionInfo.status === 'low-resources' && connectionInfo.canEdit) {
      studioClient.navigateToEditConnectionProvider(connectionInfo.name);
      return;
    }
    if (connectionInfo.status == 'no-machine') {
      studioClient.navigateToResources();
    }
  }
}
</script>

{#if title && description}
  <div
    class="w-full {background === 'light'
      ? 'bg-charcoal-500'
      : 'bg-charcoal-800'} border-t-[3px] border-red-700 p-4 mt-5 shadow-inner">
    <div class="flex flex-row space-x-3">
      <div class="flex">
        <Fa icon="{faCircleExclamation}" class="text-red-600" />
      </div>
      <div class="flex flex-col grow">
        <span class="font-medium text-sm">{title}</span>
        <span class="text-sm">{description}</span>
      </div>
      {#if actionName}
        <div class="flex items-center">
          <Button class="grow text-gray-500" on:click="{executeCommand}">{actionName}</Button>
        </div>
      {/if}
    </div>
  </div>
{/if}
