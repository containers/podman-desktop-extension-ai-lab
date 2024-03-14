<script lang="ts">
import './app.css';
import '@fortawesome/fontawesome-free/css/all.min.css';
import { router } from 'tinro';
import Route from '/@/Route.svelte';
import Navigation from '/@/lib/Navigation.svelte';
import Dashboard from '/@/pages/Dashboard.svelte';
import Recipes from '/@/pages/Recipes.svelte';
import Applications from './pages/Applications.svelte';
import Preferences from '/@/pages/Preferences.svelte';
import Models from '/@/pages/Models.svelte';
import Recipe from '/@/pages/Recipe.svelte';
import Model from './pages/Model.svelte';
import { onMount } from 'svelte';
import { getRouterState } from '/@/utils/client';
import CreateService from '/@/pages/CreateService.svelte';
import Services from '/@/pages/InferenceServers.svelte';
import ServiceDetails from '/@/pages/InferenceServerDetails.svelte';
import Playgrounds from './pages/Playgrounds.svelte';
import Playground from './pages/Playground.svelte';

router.mode.hash();

let isMounted = false;

onMount(() => {
  // Load router state on application startup
  const state = getRouterState();
  router.goto(state.url);
  isMounted = true;
});
</script>

<Route path="/*" breadcrumb="Home" isAppMounted="{isMounted}" let:meta>
  <main class="flex flex-col w-screen h-screen overflow-hidden bg-charcoal-700">
    <div class="flex flex-row w-full h-full overflow-hidden">
      <Navigation meta="{meta}" />

      <!-- Dashboard -->
      <Route path="/" breadcrumb="IA Studio Dashboard Page">
        <Dashboard />
      </Route>

      <!-- Recipes Catalog -->
      <Route path="/recipes" breadcrumb="Recipes Catalog">
        <Recipes />
      </Route>

      <!-- Applications -->
      <Route path="/applications" breadcrumb="AI Apps">
        <Applications />
      </Route>

      <!-- Playgrounds -->
      <Route path="/playgrounds" breadcrumb="Playgrounds environments">
        <Playgrounds />
      </Route>
      <Route path="/playground/:id/*" breadcrumb="Playground environment" let:meta>
        <Playground playgroundId="{meta.params.id}" />
      </Route>

      <!-- Preferences -->
      <Route path="/preferences" breadcrumb="Preferences">
        <Preferences />
      </Route>

      <Route path="/recipe/:id/*" breadcrumb="Recipe Details" let:meta>
        <Recipe recipeId="{meta.params.id}" />
      </Route>

      <Route path="/models/*" breadcrumb="Models">
        <Models />
      </Route>

      <Route path="/model/:id/*" breadcrumb="Model Details" let:meta>
        <Model modelId="{meta.params.id}" />
      </Route>

      <Route path="/services/*" breadcrumb="Services">
        <Services />
      </Route>

      <Route path="/service/:id/*" breadcrumb="Service Details" let:meta>
        {#if meta.params.id === 'create'}
          <CreateService />
        {:else}
          <ServiceDetails containerId="{meta.params.id}" />
        {/if}
      </Route>
    </div>
  </main>
</Route>
