<script lang="ts">
import Select from '/@/lib/select/Select.svelte';
import { inferenceProviders } from '/@/stores/inferenceProviders';

interface Props {
  disabled?: boolean;
  value: string | undefined;
  exclude?: string[];
}
let { value = $bindable(), disabled, exclude = [] }: Props = $props();

// Create a derived store for providerOptions filtering by exclude and enabled
let providerOptions = $derived(() => {
  return $inferenceProviders
    .filter(name => !exclude.includes(name))
    .map(name => ({
      value: name,
      label: name,
    }));
});

function handleOnChange(nValue: { value: string } | undefined): void {
  if (nValue) {
    value = nValue.value;
  } else {
    value = undefined;
  }
}
</script>

<Select
  label="Select Inference Provider"
  name="select-inference-provider"
  disabled={disabled}
  value={value ? { label: value, value: value } : undefined}
  onchange={handleOnChange}
  placeholder="Select Inference Provider to use"
  items={providerOptions()} />
