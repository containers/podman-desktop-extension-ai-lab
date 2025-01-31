<script lang="ts">
export let name: string;
export let min: string;
export let max: string;
export let step: string;
export let value: number;
</script>

<div>
  <div class="flex flex-row items-center">
    <span class="w-full uppercase text-[var(--pd-content-card-text)]">{name}</span>
    <input
      bind:value={value}
      type="number"
      name={`${name}-input`}
      min={min}
      max={max}
      step={step}
      placeholder={name}
      class="p-2 w-24 text-right outline-hidden text-sm bg-[var(--pd-content-card-bg)] rounded-xs text-[var(--pd-content-card-text)] placeholder-[var(--pd-content-card-text)]" />
  </div>
  <div class="w-full">
    <input
      type="range"
      name={`${name}-range`}
      min={min}
      max={max}
      step={step}
      placeholder={name}
      bind:value={value}
      aria-label={`${name} slider`}
      class="w-full h-1 bg-[var(--pd-button-primary-bg)] rounded-lg appearance-none accent-[var(--pd-button-primary-bg)] cursor-pointer range-xs mt-2" />
  </div>
</div>
