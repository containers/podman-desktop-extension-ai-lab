<script lang="ts">
import { faCheckCircle, faDownload } from '@fortawesome/free-solid-svg-icons';
import Select from './Select.svelte';
import Fa from 'svelte-fa';
import type { ModelInfo } from '@shared/src/models/IModelInfo';

export let disabled: boolean = false;
/**
 * Recommended model ids
 */
export let recommended: string[] | undefined = undefined;

/**
 * List of models
 */
export let models: ModelInfo[];

function getModelSortingScore(modelInfo: ModelInfo): number {
  let score: number = 0;
  if (modelInfo.file) score -= 1;
  if (recommended?.includes(modelInfo.id)) score -= 1;
  return score;
}

/**
 * Current value selected
 */
export let value: ModelInfo | undefined = undefined;

/**
 * Handy mechanism to provide the mandatory property `label` and `value` to the Select component
 */
let selected: (ModelInfo & { label: string; value: string }) | undefined = undefined;
$: {
  // let's select a default model
  if (value) {
    selected = { ...value, label: value.name, value: value.id };
  }
}

function handleOnChange(nValue: (ModelInfo & { label: string; value: string }) | undefined): void {
  value = nValue;
}
</script>

<Select
  label="Select Model"
  name="select-model"
  disabled={disabled}
  value={selected}
  onchange={handleOnChange}
  placeholder="Select model to use"
  items={models
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
