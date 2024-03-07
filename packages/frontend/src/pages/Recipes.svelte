<script lang="ts">
import NavPage from '/@/lib/NavPage.svelte';
import RecipesCard from '/@/lib/RecipesCard.svelte';
import { RECENT_CATEGORY_ID } from '/@/utils/client';
import { catalog } from '/@/stores/catalog';
</script>

<NavPage title="Recipe Catalog" searchEnabled="{false}">
  <div slot="content" class="flex flex-col min-w-full min-h-full">
    <div class="min-w-full min-h-full flex-1">
      <div class="px-5 space-y-5 h-full">
        <RecipesCard primaryBackground="" secondaryBackground="bg-charcoal-800" displayCategory="{false}" />
      </div>
    </div>
  </div>
</NavPage>
