<script lang="ts">
import Select from '/@/lib/select/Select.svelte';
import { InferenceType } from '@shared/models/IInference';

interface Props {
  disabled?: boolean;
  value: InferenceType | undefined;
  exclude?: InferenceType[];
}
let { value = $bindable(), disabled, exclude = [] }: Props = $props();

// Filter options based on exclude list
const options = Object.values(InferenceType).filter(type => type !== InferenceType.NONE) as Array<InferenceType>;
const filteredOptions = options.filter(type => type === InferenceType.ALL || !exclude.includes(type));

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
  items={filteredOptions.map(type => ({
    value: type,
    label: type,
  }))} />
