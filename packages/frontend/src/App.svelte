<script lang="ts">
import './app.css';
import '@fortawesome/fontawesome-free/css/all.min.css';
import { router } from 'tinro';
import Route from '/@/Route.svelte';
import Navigation from '/@/lib/Navigation.svelte';
import Dashboard from '/@/pages/Dashboard.svelte';
import Recipes from '/@/pages/Recipes.svelte';
import Environments from '/@/pages/Environments.svelte';
import Preferences from '/@/pages/Preferences.svelte';
import Registries from '/@/pages/Registries.svelte';
import Models from '/@/pages/Models.svelte';
import Recipe from '/@/pages/Recipe.svelte';

router.mode.hash();
</script>


<Route path="/*" breadcrumb="Home" let:meta>
  <main class="flex flex-col w-screen h-screen overflow-hidden bg-charcoal-700">
    <div class="flex flex-row w-full h-full overflow-hidden">
      <Navigation meta="{meta}"/>

      <!-- Dashboard -->
      <Route path="/" breadcrumb="IA Studio Dashboard Page">
        <Dashboard/>
      </Route>

      <!-- Recipes Catalog -->
      <Route path="/recipes" breadcrumb="Recipes Catalog">
        <Recipes/>
      </Route>

      <!-- Environments -->
      <Route path="/environments" breadcrumb="Environments">
        <Environments/>
      </Route>

      <!-- Models -->
      <Route path="/models" breadcrumb="Models">
        <Models/>
      </Route>

      <!-- Registries -->
      <Route path="/registries" breadcrumb="Registries">
        <Registries/>
      </Route>

      <!-- Preferences -->
      <Route path="/preferences" breadcrumb="Preferences">
        <Preferences/>
      </Route>

      <Route path="/recipes/:id/*" breadcrumb="Recipe Details" let:meta>
        <Recipe recipeId="{meta.params.id}"/>
      </Route>
    </div>
  </main>
</Route>
