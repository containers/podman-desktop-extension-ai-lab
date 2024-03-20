<script lang="ts">
export let name: string;
export let min: string;
export let max: string;
export let step: string;
export let value: number;
</script>

<div>
  <div class="flex flex-row items-center">
    <span class="w-full uppercase text-gray-700">{name}</span>
    <input
      bind:value="{value}"
      type="number"
      name="{`${name}-input`}"
      min="{min}"
      max="{max}"
      step="{step}"
      placeholder="{name}"
      class="p-2 w-24 text-right outline-none text-sm bg-charcoal-800 rounded-sm text-gray-700 placeholder-gray-700" />
  </div>
  <div class="w-full">
    <input
      type="range"
      name="{`${name}-range`}"
      min="{min}"
      max="{max}"
      step="{step}"
      placeholder="{name}"
      bind:value="{value}"
      aria-label="{`${name} slider`}"
      class="w-full h-1 bg-violet-600 rounded-lg appearance-none accent-violet-600 cursor-pointer range-xs mt-2" />
  </div>
</div>
