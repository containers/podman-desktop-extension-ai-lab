<script lang="ts">
import NavPage from '/@/lib/NavPage.svelte';
import MarkdownRenderer from '/@/lib/markdown/MarkdownRenderer.svelte';
import { getDashboardContent } from './dashboard';
</script>

<NavPage searchEnabled="{false}" title="Dashboard">
  <div slot="content" class="flex flex-col min-w-full h-fit">
    <div class="min-w-full flex-1" aria-label="inner-content">
      <MarkdownRenderer source="{getDashboardContent()}" />
    </div>
  </div>
</NavPage>
