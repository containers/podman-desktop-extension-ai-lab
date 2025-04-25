<script lang="ts">
import { faCheckCircle, faDownload } from '@fortawesome/free-solid-svg-icons';
import Select from './Select.svelte';
import Fa from 'svelte-fa';
import type { ModelInfo } from '@shared/models/IModelInfo';
import { onMount } from 'svelte';
import { configuration } from '/@/stores/extensionConfiguration';

interface Props {
  disabled?: boolean;
  /**
   * Recommended model ids
   */
  recommended?: string[];
  /**
   * List of models
   */
  models: ModelInfo[];
  /**
   * Current value selected
   */
  value: ModelInfo | undefined;
}

let { disabled = false, recommended, models, value = $bindable() }: Props = $props();

function getModelSortingScore(modelInfo: ModelInfo): number {
  let score: number = 0;
  if (modelInfo.file) score -= 1;
  if (recommended?.includes(modelInfo.id)) score -= 1;
  return score;
}

/**
 * Handy mechanism to provide the mandatory property `label` and `value` to the Select component
 */
let selected: (ModelInfo & { label: string; value: string }) | undefined = $derived.by(() => {
  // let's select a default model
  if (value) {
    return { ...value, label: value.name, value: value.id };
  } else {
    return undefined;
  }
});

function handleOnChange(nValue: (ModelInfo & { label: string; value: string }) | undefined): void {
  value = nValue;
}

let defaultRuntime: string = 'llama-cpp';

onMount(() => {
  return configuration.subscribe(values => {
    if (values?.inferenceRuntime) {
      defaultRuntime = values.inferenceRuntime;
    }
  });
});
</script>

<Select
  label="Select Model"
  name="select-model"
  disabled={disabled}
  value={selected}
  onchange={handleOnChange}
  placeholder="Select model to use"
  items={models
    .filter(model => model.backend === defaultRuntime)
    .toSorted((a, b) => getModelSortingScore(a) - getModelSortingScore(b))
    .map(model => ({ ...model, value: model.id, label: model.name }))}>
  <div slot="item" let:item>
    <div class="flex items-center">
      <div class="grow">
        <span>{item.name}</span>
        {#if recommended?.includes(item.id)}
          <i class="fas fa-star fa-xs" title="Recommended model"></i>
        {/if}
      </div>

      {#if item.file !== undefined}
        <Fa icon={faCheckCircle} />
      {:else}
        <Fa icon={faDownload} />
      {/if}
    </div>
  </div>
</Select>
