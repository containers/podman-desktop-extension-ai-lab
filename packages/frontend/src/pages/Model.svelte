<script lang="ts">
import NavPage from '/@/lib/NavPage.svelte';
import Tab from '/@/lib/Tab.svelte';
import MarkdownRenderer from '/@/lib/markdown/MarkdownRenderer.svelte';
import { catalog } from '/@/stores/catalog';

export let modelId: string;

$: model = $catalog.models.find(m => m.id === modelId);
</script>

<NavPage title="{model?.name || ''}" searchEnabled="{false}" loading="{model === undefined}">
  <svelte:fragment slot="content">
    <div class="flex flex-row w-full">
      <div class="flex-grow p-5">
        <MarkdownRenderer source="{model?.description}" />
      </div>
    </div>
  </svelte:fragment>
</NavPage>
