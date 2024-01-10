<script lang="ts">
import NavPage from '/@/lib/NavPage.svelte';
import RecipesCard from '/@/lib/RecipesCard.svelte';
import { onMount } from 'svelte';
import { RECENT_CATEGORY_ID, studioClient } from '/@/utils/client';
import type { Category } from '@shared/models/ICategory';

$: categories = [] as Category[]


onMount(async () => {
  categories = await studioClient.getCategories()
})

</script>

<NavPage title="Recipe Catalog">
  <div slot="content" class="flex flex-col min-w-full min-h-full">
    <div class="min-w-full min-h-full flex-1">
      <div class="px-5 space-y-5 h-full">

        <!-- Recent recipes -->
        <RecipesCard
          category="{{id: RECENT_CATEGORY_ID, name: 'Recently-viewed recipes'}}"
          class="p-6"
          displayDescription="{false}"
        />

        {#each categories as category}
          <!-- Natural Language processing -->
          <RecipesCard
            category="{category}"
            primaryBackground=""
            secondaryBackground="bg-charcoal-800"
            displayCategory="{false}"
          />
        {/each}
      </div>
    </div>
  </div>
</NavPage>
