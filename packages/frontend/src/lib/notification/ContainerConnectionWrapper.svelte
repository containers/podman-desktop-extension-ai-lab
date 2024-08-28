<script lang="ts">
import type {
  ContainerConnectionResourceInfo,
  ContainerProviderConnectionInfo,
} from '@shared/src/models/IContainerConnectionInfo';
import type { ModelCheckerContext, ModelInfo } from '@shared/src/models/IModelInfo';
import ContainerConnectionStatusInfo from './ContainerConnectionStatusInfo.svelte';
import { studioClient } from '/@/utils/client';

export let containerProviderConnection: ContainerProviderConnectionInfo | undefined = undefined;
export let model: ModelInfo | undefined = undefined;
export let checkContext: ModelCheckerContext = 'inference';

let connectionInfo: ContainerConnectionResourceInfo | undefined;
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
} else {
  connectionInfo = undefined;
}
</script>

{#if connectionInfo}
  <ContainerConnectionStatusInfo connectionInfo={connectionInfo} />
{/if}
