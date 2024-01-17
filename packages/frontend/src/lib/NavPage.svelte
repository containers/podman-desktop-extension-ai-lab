<script lang="ts">
import Fa from 'svelte-fa';
import type { IconDefinition } from '@fortawesome/free-regular-svg-icons';
import LinearProgress from '/@/lib/progress/LinearProgress.svelte';

export let title: string;
export let searchTerm = '';
export let searchEnabled = true;
export let loading = false;
export let icon: IconDefinition | undefined = undefined;
</script>

<div class="flex flex-col w-full h-full shadow-pageheader">
  <div class="flex flex-col w-full h-full pt-4" role="region" aria-label="{title}">
    <div class="flex pb-2 px-5" role="region" aria-label="header">
        <div class="flex flex-col">
          <div class="flex flex-row">
            {#if icon}
              <div class="bg-charcoal-800 rounded-full w-8 h-8 flex items-center justify-center mr-3">
                <Fa size="20" class="text-purple-500" icon="{icon}" />
              </div>
            {/if}
            <h1 class="text-xl first-letter:uppercase">{title}</h1>
          </div>
          <slot name="subtitle" />
        </div>

        <div class="flex flex-1 justify-end">
          {#if searchEnabled}
            <div class="flex flex-row" role="region" aria-label="search">
              <div class="pl-5 lg:w-[35rem] w-[22rem] flex justify-end items-center">
                <div class="w-full flex items-center bg-charcoal-800 text-gray-700 rounded-sm">
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    class="w-5 h-5 ml-2 mr-2"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor">
                    <path
                      stroke-linecap="round"
                      stroke-linejoin="round"
                      stroke-width="2"
                      d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"></path>
                  </svg>
                  <input
                    bind:value="{searchTerm}"
                    type="text"
                    name="containerSearchName"
                    placeholder="Search {title}...."
                    class="w-full py-2 outline-none text-sm bg-charcoal-800 rounded-sm text-gray-700 placeholder-gray-700" />
                </div>
              </div>
            </div>
          {/if}
        </div>
      </div>

    <div class="flex flex-row px-2 border-b border-charcoal-400">
      <slot name="tabs" />
    </div>
    <div class="flex w-full h-full overflow-auto" role="region" aria-label="content">
      {#if loading}
        <LinearProgress/>
      {:else}
        <slot name="content" />
      {/if}
    </div>
  </div>
</div>
