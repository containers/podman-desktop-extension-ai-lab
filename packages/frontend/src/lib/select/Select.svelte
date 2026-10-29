<script lang="ts" generics="T extends { label: string; value: string }">
import Select from 'svelte-select';
import type { Snippet } from 'svelte';

interface Props {
  disabled?: boolean;
  value?: T;
  items?: T[];
  placeholder?: string;
  label?: string;
  name?: string;
  onchange?: (value: T | undefined) => void;
  /**
   * Custom rendering of an item, the label is displayed by default
   */
  item?: Snippet<[T]>;
}

let { disabled = false, value, items = [], placeholder, label, name, onchange, item: itemSnippet }: Props = $props();

function handleOnChange(newValue: T | undefined): void {
  // svelte-select provides its internal state proxy, which cannot be cloned (e.g. sent through postMessage)
  onchange?.($state.snapshot(newValue) as T | undefined);
}

function handleOnClear(): void {
  onchange?.(undefined);
}
</script>

<Select
  inputAttributes={{ 'aria-label': label }}
  name={name}
  disabled={disabled}
  value={value}
  onclear={handleOnClear}
  onchange={handleOnChange}
  --item-color="var(--pd-dropdown-item-text)"
  --item-is-active-color="var(--pd-dropdown-item-text)"
  --item-hover-color="var(--pd-dropdown-item-hover-text)"
  --item-active-background="var(--pd-input-field-hover-stroke)"
  --item-is-active-bg="var(--pd-input-field-hover-stroke)"
  --background="var(--pd-dropdown-bg)"
  --list-background="var(--pd-dropdown-bg)"
  --item-hover-bg="var(--pd-dropdown-item-hover-bg)"
  --border="1px solid var(--pd-input-field-focused-bg)"
  --border-hover="1px solid var(--pd-input-field-hover-stroke)"
  --list-border="1px solid var(--pd-input-field-focused-bg)"
  --border-focused="var(--pd-input-field-focused-bg)"
  placeholder={placeholder}
  class="bg-(--pd-content-bg)! text-(--pd-content-card-text)!"
  items={items}
  showChevron>
  {#snippet item({ item })}
    {#if itemSnippet}
      {@render itemSnippet(item as T)}
    {:else}
      <div>{item.label}</div>
    {/if}
  {/snippet}
</Select>
