<script lang="ts">
import type { ContainerProviderConnectionInfo } from '@shared/src/models/IContainerConnectionInfo';
import Select from '/@/lib/select/Select.svelte';

export let disabled: boolean = false;
import { VMType } from '@shared/src/models/IPodman';

/**
 * Current value selected
 */
export let value: ContainerProviderConnectionInfo | undefined = undefined;
export let containerProviderConnections: ContainerProviderConnectionInfo[] = [];
/**
 * Handy mechanism to provide the mandatory property `label` and `value` to the Select component
 */
let selected: (ContainerProviderConnectionInfo & { label: string; value: string }) | undefined = undefined;
$: {
  // let's select a default model
  if (value) {
    selected = { ...value, label: value.name, value: value.name };
  }
}

function handleOnChange(nValue: ContainerProviderConnectionInfo | undefined): void {
  value = nValue;
}
</script>

<Select
  label="Select Container Engine"
  name="select-container-engine"
  disabled={disabled}
  bind:value={selected}
  onchange={handleOnChange}
  placeholder="Select container provider to use"
  items={containerProviderConnections.map(containerProviderConnection => ({
    ...containerProviderConnection,
    value: containerProviderConnection.name,
    label: containerProviderConnection.name,
  }))}>
  <div slot="item" let:item>
    <div class="flex items-center">
      <div class="grow">
        <span>{item.name}</span>
      </div>

      {#if item.vmType !== VMType.UNKNOWN}
        <div>({item.vmType})</div>
      {/if}
    </div>
  </div>
</Select>
