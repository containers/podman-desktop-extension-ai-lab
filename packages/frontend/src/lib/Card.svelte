<script lang="ts">
import Fa from 'svelte-fa';
import type { IconDefinition } from '@fortawesome/free-regular-svg-icons';
import { createEventDispatcher } from 'svelte';
const dispatch = createEventDispatcher();

export let title: string | undefined = undefined;
export let description: string | undefined = undefined;
export let classes: string = '';

export let href: string | undefined = undefined;

export let icon: IconDefinition | undefined = undefined;

export let primaryBackground: string = 'bg-charcoal-800';
</script>

<a class="no-underline" href="{href}">
  <div class="{classes} rounded-md flex-nowrap overflow-hidden" role="region" aria-label="{title ?? 'Card'}">
    <div class="flex flex-row">
      <div class="flex flex-row items-start">
        {#if icon}
          <button
            on:click="{() => dispatch('click')}"
            class="{primaryBackground} rounded-full min-w-7 min-h-7 w-7 h-7 flex items-center justify-center mr-3">
            <Fa size="1x" class="text-purple-500 cursor-pointer" icon="{icon}" />
          </button>
        {/if}
        <div
          class="flex flex-col text-[var(--pd-content-card-text)] whitespace-normal space-y-2"
          aria-label="context-name">
          {#if title}
            <div class="text-sm">
              {title}
            </div>
          {/if}
          {#if description}
            <div class="text-xs">
              {description}
            </div>
          {/if}
        </div>
      </div>
    </div>
    <div class="flex overflow-hidden" role="region" aria-label="content">
      <slot name="content" />
    </div>
  </div>
</a>
