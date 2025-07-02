<script lang="ts">
import Select from '/@/lib/select/Select.svelte';
import type { InferenceType } from '@shared/models/IInference';

interface Props {
  disabled?: boolean;
  value: InferenceType | undefined;
  providers: InferenceType[];
  exclude?: InferenceType[];
}
let { value = $bindable(), disabled, providers, exclude = [] }: Props = $props();

// Filter options based on optional exclude list
const options = $derived(() =>
  providers.filter(type => !exclude.includes(type)).map(type => ({ value: type, label: type })),
);

function handleOnChange(nValue: { value: string } | undefined): void {
  if (nValue) {
    value = nValue.value as InferenceType;
  } else {
    value = undefined;
  }
}
</script>

<Select
  label="Select Inference Runtime"
  name="select-inference-runtime"
  disabled={disabled}
  value={value ? { label: value, value: value } : undefined}
  onchange={handleOnChange}
  placeholder="Select Inference Runtime to use"
  items={options()} />
