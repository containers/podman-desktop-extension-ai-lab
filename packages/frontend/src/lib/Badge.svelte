<script lang="ts">
import type { IconDefinition } from '@fortawesome/free-regular-svg-icons';
import Fa from 'svelte-fa';

interface Props {
  icon?: IconDefinition;
  content: string;
  background?: string;
}

let { icon, content, background = 'bg-[var(--pd-label-bg)]' }: Props = $props();
</script>

<div
  class="{background} rounded-md px-2 py-1 flex flex-row w-min h-min text-[var(--pd-label-text)] text-nowrap items-center text-sm">
  {#if icon}
    <Fa class="mr-2" icon={icon} />
  {/if}
  {content}
</div>
