<script lang="ts">
// Full duplicates
import type { TinroRouteMeta } from 'tinro';
import type { IconDefinition } from '@fortawesome/free-regular-svg-icons';
import Fa from 'svelte-fa';

export let title: string;
export let href: string;
export let meta: TinroRouteMeta;
export let section = false;
export let expanded = false;
export let child = false;
export let icon: IconDefinition | undefined = undefined;

let selected: boolean;
$: selected = meta.url === href;

function rotate(node: unknown, { clockwise = true }) {
  return {
    duration: 200,
    css: (t: unknown, u: number) => {
      if (!clockwise) u = -u;
      return `
        transform: rotate(${u * 90}deg);
        transform-origin: center center;`;
    },
  };
}
</script>

<a class="no-underline" href="{href}" aria-label="{title}" on:click="{() => (expanded = !expanded)}">
  <div
    class="flex w-full pr-1 py-2 justify-between items-center cursor-pointer border-l-[4px] border-charcoal-800"
    class:text-white="{selected}"
    class:pl-3="{!child}"
    class:pl-4="{child}"
    class:leading-none="{child}"
    class:text-sm="{child}"
    class:font-extralight="{child}"
    class:font-semibold="{!child}"
    class:bg-charcoal-300="{selected}"
    class:border-purple-500="{selected}"
    class:text-gray-400="{!selected}"
    class:hover:text-gray-300="{!selected}"
    class:hover:bg-charcoal-500="{!selected}"
    class:hover:border-charcoal-500="{!selected}">
    <span class="group-hover:block flex flex-row items-center" class:capitalize="{!child}">
      {#if icon}
        <Fa class="mr-4" icon="{icon}" />
      {/if}
      {title}
    </span>
    {#if section}
      <div class="px-2 relative w-4 h-4">
        {#if expanded}
          <i
            class="fas fa-angle-down text-lg absolute left-0 top-0"
            aria-hidden="true"
            in:rotate="{{ clockwise: false }}"
            out:rotate="{{ clockwise: false }}"></i>
        {:else}
          <i
            class="fas fa-angle-right text-lg absolute left-0 top-0"
            aria-hidden="true"
            in:rotate="{{}}"
            out:rotate="{{}}"></i>
        {/if}
      </div>
    {/if}
  </div>
</a>
