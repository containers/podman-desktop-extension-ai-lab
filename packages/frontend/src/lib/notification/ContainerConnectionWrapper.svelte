<script lang="ts">
import type {
  ContainerConnectionInfo,
  ContainerProviderConnectionInfo,
} from '@shared/src/models/IContainerConnectionInfo';
import type { ModelCheckerContext, ModelInfo } from '@shared/src/models/IModelInfo';
import ContainerConnectionStatusInfo from './ContainerConnectionStatusInfo.svelte';
import { studioClient } from '/@/utils/client';
import { configuration } from '/@/stores/extensionConfiguration';
import { fromStore } from 'svelte/store';
import GPUEnabledMachine from '/@/lib/notification/GPUEnabledMachine.svelte';
import { VMType } from '@shared/src/models/IPodman';

interface Props {
  containerProviderConnection?: ContainerProviderConnectionInfo;
  model?: ModelInfo;
  checkContext?: ModelCheckerContext;
}

let { containerProviderConnection, model, checkContext = 'inference' }: Props = $props();

let connectionInfo: ContainerConnectionInfo | undefined = $state();
let gpuWarningRequired: boolean = $derived(
  !!(
    containerProviderConnection &&
    fromStore(configuration)?.current?.experimentalGPU &&
    shouldRecommendGPU(containerProviderConnection)
  ),
);

function shouldRecommendGPU(connection: ContainerProviderConnectionInfo): boolean {
  return connection.vmType === VMType.APPLEHV || connection.vmType === VMType.APPLEHV_LABEL;
}

async function checkContainerConnectionStatusAndResources(): Promise<void> {
  try {
    connectionInfo = await studioClient.checkContainerConnectionStatusAndResources({
      model: model as ModelInfo & { memory: number },
      context: checkContext,
      connection: containerProviderConnection,
    });
  } catch (err: unknown) {
    console.error(err);
    connectionInfo = undefined;
  }
}

$effect(() => {
  if (typeof model?.memory === 'number' && containerProviderConnection) {
    checkContainerConnectionStatusAndResources().catch(console.error);
  } else {
    connectionInfo = undefined;
  }
});
</script>

{#if gpuWarningRequired}
  <GPUEnabledMachine />
{/if}
{#if connectionInfo}
  <ContainerConnectionStatusInfo connectionInfo={connectionInfo} />
{/if}
