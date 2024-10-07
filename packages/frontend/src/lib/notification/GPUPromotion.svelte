<script lang="ts">
import { Button, Checkbox } from '@podman-desktop/ui-svelte';
import { studioClient } from '/@/utils/client';
import { configuration } from '/@/stores/extensionConfiguration';
import MarkdownRenderer from '/@/lib/markdown/MarkdownRenderer.svelte';

const actionName = 'Don\'t display anymore';

function hideGPUPromotionBanner(): void {
  studioClient.updateExtensionConfiguration({ showGPUPromotion: false }).catch(console.error);
}

function enableGPUSupport(): void {
  studioClient.updateExtensionConfiguration({ experimentalGPU: true }).catch(console.error);
}

const content =
  'GPU support is not enabled. Podman AI Lab supports GPU on Windows on MacOS.\n\nThis greatly enhance the developer experience when running inference servers. We recommend you to enable it.';
</script>

{#if $configuration?.showGPUPromotion && !$configuration?.experimentalGPU}
  <div
    class="w-full bg-[var(--pd-content-card-bg)] text-[var(--pd-content-card-text)] border-t-[3px] border-amber-500 p-4 mt-5 shadow-inner"
    aria-label="GPU promotion banner">
    <div class="flex flex-col space-x-3">
      <span class="font-normal items-center" aria-label="title"
        >⚡️ Supercharge Your AI: Enable GPU Acceleration and watch your LLM respond in a flash!
      </span>
      <div class="flex flex-row">
        <div class="flex-grow">
          <MarkdownRenderer source={content} />
        </div>
        <div class="flex flex-col">
          <Button class="w-auto ml-1 text-gray-500" on:click={enableGPUSupport} aria-label="Enable GPU support"
            >Enable GPU support</Button>
          <Checkbox class="w-auto ml-1 text-gray-500" on:click={hideGPUPromotionBanner} aria-label={actionName}
            >{actionName}</Checkbox>
        </div>
      </div>
    </div>
  </div>
{/if}
