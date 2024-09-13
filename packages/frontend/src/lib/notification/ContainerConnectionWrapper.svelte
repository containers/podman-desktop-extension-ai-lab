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

export let containerProviderConnection: ContainerProviderConnectionInfo | undefined = undefined;
export let model: ModelInfo | undefined = undefined;
export let checkContext: ModelCheckerContext = 'inference';

let connectionInfo: ContainerConnectionInfo | undefined;
let gpuWarningRequired = false;

function shouldRecommendGPU(connection: ContainerProviderConnectionInfo): boolean {
  return connection.vmType === VMType.APPLEHV || connection.vmType === VMType.APPLEHV_LABEL;
}
$: if (typeof model?.memory === 'number' && containerProviderConnection) {
  studioClient
    .checkContainerConnectionStatusAndResources({
      model: model as ModelInfo & { memory: number },
      context: checkContext,
      connection: containerProviderConnection,
    })
    .then(result => {
      connectionInfo = result;
    })
    .catch((err: unknown) => {
      connectionInfo = undefined;
      console.error(err);
    });
  if (fromStore(configuration)?.current?.experimentalGPU && !shouldRecommendGPU(containerProviderConnection)) {
    gpuWarningRequired = true;
  }
} else {
  connectionInfo = undefined;
}
</script>

{#if !gpuWarningRequired}
  <GPUEnabledMachine />
{/if}
{#if connectionInfo}
  <ContainerConnectionStatusInfo connectionInfo={connectionInfo} />
{/if}
