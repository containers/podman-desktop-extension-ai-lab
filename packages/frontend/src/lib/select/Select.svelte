<script lang="ts">
import Select from 'svelte-select';

type T = $$Generic<{ label: string; value: string }>;
export let disabled: boolean = false;

export let value: T | undefined = undefined;
export let items: T[] = [];
export let placeholder: string | undefined = undefined;
export let label: string | undefined = undefined;
export let name: string | undefined = undefined;
export let onchange: ((value: T | undefined) => void) | undefined = undefined;

function handleOnChange(e: CustomEvent<T | undefined>): void {
  value = e.detail;
  onchange?.(value);
}

function handleOnClear(): void {
  value = undefined;
  onchange?.(value);
}
</script>

<Select
  inputAttributes={{ 'aria-label': label }}
  name={name}
  disabled={disabled}
  value={value}
  on:clear={handleOnClear}
  on:change={handleOnChange}
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
  placeholder={placeholder}
  class="bg-(--pd-content-bg)! text-(--pd-content-card-text)!"
  items={items}
  showChevron>
  <div slot="item" let:item>
    <slot name="item" item={item}>
      <div>{item.label}</div>
    </slot>
  </div>
</Select>
