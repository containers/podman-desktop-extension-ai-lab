<script lang="ts">
import NavPage from '/@/lib/NavPage.svelte';
import MarkdownRenderer from '/@/lib/markdown/MarkdownRenderer.svelte';
import { getDashboardContent } from './dashboard';
import Button from '/@/lib/button/Button.svelte';
import { faGithub } from '@fortawesome/free-brands-svg-icons';
import { studioClient } from '/@/utils/client';

const openGithub = () => {
  studioClient.openURL("https://github.com/projectatomic/ai-studio");
}

</script>

<NavPage searchEnabled="{false}" title="Dashboard">
  <svelte:fragment slot="additional-actions">
    <Button type="secondary" title="Open GitHub repository" on:click={openGithub} icon="{faGithub}">Github</Button>
  </svelte:fragment>
  <div slot="content" class="flex flex-col min-w-full h-fit">
    <div class="min-w-full flex-1 px-5 pt-5" aria-label="inner-content">
      <MarkdownRenderer source="{getDashboardContent()}" />
    </div>
  </div>
</NavPage>
