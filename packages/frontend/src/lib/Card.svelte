<script lang="ts">
import Fa from 'svelte-fa';
import type { IconDefinition } from '@fortawesome/free-regular-svg-icons';

export let title: string;
export let classes: string = "";

export let href: string | undefined = undefined;

export let icon: IconDefinition | undefined = undefined

export let primaryBackground: string = "bg-charcoal-800"
</script>

<a class="no-underline" href="{href}">
  <div class="{classes} rounded-md flex-nowrap overflow-hidden" role="region">
    <div class="flex flex-row">
      <div class="flex flex-row items-center">
        {#if icon}
          <div class="{primaryBackground} rounded-full w-8 h-8 flex items-center justify-center mr-3">
            <Fa size="20" class="text-purple-500 cursor-pointer" icon="{icon}" />
          </div>
        {/if}
        <div class="flex flex-col text-gray-400 whitespace-nowrap" aria-label="context-name">
          <div class="flex flex-row items-center">
            {title}
          </div>
        </div>
      </div>
    </div>
    <div class="flex overflow-auto" role="region" aria-label="content">
      <slot name="content" />
    </div>
  </div>
</a>

