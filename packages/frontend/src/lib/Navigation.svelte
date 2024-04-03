<script lang="ts">
import SettingsNavItem from '/@/lib/SettingsNavItem.svelte';
import type { TinroRouteMeta } from 'tinro';
import Fa from 'svelte-fa';
import { faBookOpen, faBrain, faMessage, faRocket, faServer } from '@fortawesome/free-solid-svg-icons';

export let meta: TinroRouteMeta;
</script>

<nav
  class="z-1 w-leftsidebar min-w-leftsidebar shadow flex-col justify-between flex transition-all duration-500 ease-in-out bg-charcoal-800"
  aria-label="PreferencesNavigation">
  <div class="flex items-center">
    <a href="/" title="Navigate to dashboard" class="pt-6 pl-3 px-5 mb-10 flex items-center ml-[4px]">
      <Fa size="1.5x" class="text-purple-500 cursor-pointer mr-4" icon="{faBrain}" />
      <p class="text-xl first-letter:uppercase">AI Lab</p>
    </a>
  </div>
  <div class="h-full overflow-hidden hover:overflow-y-auto" style="margin-bottom:auto">
    <!-- AI Apps -->
    <span class="pl-3 text-sm text-gray-700 ml-[4px]">AI APPS</span>
    <SettingsNavItem icon="{faBookOpen}" title="Recipes Catalog" href="/recipes" bind:meta="{meta}" />
    <SettingsNavItem icon="{faServer}" title="Running" href="/applications" bind:meta="{meta}" />

    <!-- Models -->
    <div class="pl-3 mt-2 ml-[4px]">
      <span class="text-sm text-gray-700">MODELS</span>
    </div>
    <SettingsNavItem icon="{faBookOpen}" title="Catalog" href="/models" bind:meta="{meta}" />
    <SettingsNavItem icon="{faRocket}" title="Services" href="/services" bind:meta="{meta}" />
    <SettingsNavItem icon="{faMessage}" title="Playgrounds" href="/playgrounds" bind:meta="{meta}" />
  </div>
</nav>
