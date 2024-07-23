<script lang="ts">
import { faCheckCircle, faDownload } from '@fortawesome/free-solid-svg-icons';
import Select from 'svelte-select';
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
</script>

<Select
  inputAttributes={{ 'aria-label': 'Select Model' }}
  name="select-model"
  disabled={disabled}
  value={selected}
  on:change={e => (value = e.detail)}
  --item-color={'var(--pd-dropdown-item-text)'}
  --item-is-active-color={'var(--pd-dropdown-item-text)'}
  --item-hover-color="var(--pd-dropdown-item-hover-text)"
  --item-active-background="var(--pd-input-field-hover-stroke)"
  --item-is-active-bg="var(--pd-input-field-hover-stroke)"
  --background={'var(--pd-dropdown-bg)'}
  --list-background={'var(--pd-dropdown-bg)'}
  --item-hover-bg="var(--pd-dropdown-item-hover-bg)"
  --border="1px solid var(--pd-input-field-focused-bg)"
  --border-hover="1px solid var(--pd-input-field-hover-stroke)"
  --list-border="1px solid var(--pd-input-field-focused-bg)"
  --border-focused="var(--pd-input-field-focused-bg)"
  placeholder="Select model to use"
  class="!bg-[var(--pd-content-bg)] !text-[var(--pd-content-card-text)]"
  items={models
    .toSorted((a, b) => getModelSortingScore(a) - getModelSortingScore(b))
    .map(model => ({ ...model, value: model.id, label: model.name }))}
  showChevron>
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
