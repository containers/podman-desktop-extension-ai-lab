<script lang="ts">
import type { IconDefinition } from '@fortawesome/free-regular-svg-icons';
import Fa from 'svelte-fa';

export let icon: IconDefinition;
export let content: string;
export let background: string = 'bg-charcoal-600';
</script>

<div
  class="{background} rounded-md px-2 py-1 flex flex-row w-min h-min text-xs text-charcoal-100 text-nowrap items-center">
  {#if icon}
    <Fa class="mr-2" icon="{icon}" />
  {/if}
  {content}
</div>
