<script lang="ts">
import type { IconDefinition } from '@fortawesome/free-regular-svg-icons';
import Fa from 'svelte-fa';

interface Props {
  icon: IconDefinition;
  content: string;
  class?: string;
}

let { icon, content, class: classes = 'bg-[var(--pd-label-bg)] text-[var(--pd-label-text)]' }: Props = $props();
</script>

<div class="{classes} rounded-md px-2 py-1 flex flex-row w-min h-min text-nowrap items-center text-sm">
  {#if icon}
    <Fa class="mr-2" icon={icon} />
  {/if}
  {content}
</div>
