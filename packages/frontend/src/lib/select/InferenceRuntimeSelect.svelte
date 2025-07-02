<script lang="ts">
import Select from '/@/lib/select/Select.svelte';
import { InferenceType } from '@shared/models/IInference';

interface Props {
  disabled?: boolean;
  value: InferenceType | undefined;
}
let { value = $bindable(), disabled }: Props = $props();
const options = Object.values(InferenceType).filter(type => type !== InferenceType.NONE) as Array<InferenceType>;
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
  items={options.map(type => ({
    value: type,
    label: type,
  }))} />
