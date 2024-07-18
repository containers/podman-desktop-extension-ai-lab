<script lang="ts">
import type { TinroRouteMeta } from 'tinro';
import Fa from 'svelte-fa';
import { faBookOpen, faBrain, faMessage, faRocket, faServer } from '@fortawesome/free-solid-svg-icons';
import { SettingsNavItem } from '@podman-desktop/ui-svelte';

export let meta: TinroRouteMeta;
</script>

<nav
  class="z-1 w-leftsidebar min-w-leftsidebar shadow flex-col justify-between flex transition-all duration-500 ease-in-out bg-[var(--pd-secondary-nav-bg)]"
  aria-label="PreferencesNavigation">
  <div class="flex items-center">
    <a href="/" title="Navigate to dashboard" class="pt-4 pl-3 px-5 mb-10 flex items-center ml-[4px]">
      <Fa size="1.5x" class="text-purple-500 cursor-pointer mr-4" icon={faBrain} />
      <p class="text-xl first-letter:uppercase text-[color:var(--pd-secondary-nav-header-text)]">AI Lab</p>
    </a>
  </div>
  <div class="h-full overflow-hidden hover:overflow-y-auto" style="margin-bottom:auto">
    <!-- AI Apps -->
    <span class="pl-3 text-sm ml-[4px] text-[color:var(--pd-secondary-nav-header-text)]">AI APPS</span>
    <SettingsNavItem icon={faBookOpen} title="Recipes Catalog" selected={meta.url === '/recipes'} href="/recipes" />
    <SettingsNavItem icon={faServer} title="Running" selected={meta.url === '/applications'} href="/applications" />

    <!-- Models -->
    <div class="pl-3 mt-2 ml-[4px]">
      <span class="text-sm text-[color:var(--pd-secondary-nav-header-text)]">MODELS</span>
    </div>
    <SettingsNavItem icon={faBookOpen} title="Catalog" selected={meta.url === '/models'} href="/models" />
    <SettingsNavItem icon={faRocket} title="Services" selected={meta.url === '/services'} href="/services" />
    <SettingsNavItem icon={faMessage} title="Playgrounds" selected={meta.url === '/playgrounds'} href="/playgrounds" />
  </div>
</nav>
