<script lang="ts">
import SettingsNavItem from '/@/lib/SettingsNavItem.svelte';
import type { TinroRouteMeta } from 'tinro';
import Fa from 'svelte-fa';
import { faBrain } from '@fortawesome/free-solid-svg-icons';

export let meta: TinroRouteMeta;
</script>

<nav
  class="z-1 w-leftsidebar min-w-leftsidebar shadow flex-col justify-between flex transition-all duration-500 ease-in-out bg-charcoal-800"
  aria-label="PreferencesNavigation">
  <div class="flex items-center">
    <div class="pt-4 px-5 mb-10 flex items-center">
      <Fa size="24" class="text-purple-500 cursor-pointer mr-4" icon="{faBrain}" />
      <p class="text-xl first-letter:uppercase">AI Studio</p>
    </div>
  </div>
  <div class="h-full overflow-hidden hover:overflow-y-auto" style="margin-bottom:auto">
    <SettingsNavItem title="Recipe Catalog" href="/recipes" bind:meta="{meta}" />

    <SettingsNavItem title="Environments" href="/environments" bind:meta="{meta}" />

    <SettingsNavItem title="Models" href="/models" bind:meta="{meta}" />

    <SettingsNavItem title="Registries" href="/registries" bind:meta="{meta}" />

    <SettingsNavItem title="Preferences" href="/preferences" bind:meta="{meta}" />
  </div>
</nav>
