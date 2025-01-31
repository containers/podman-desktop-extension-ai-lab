<script lang="ts">
import { Button } from '@podman-desktop/ui-svelte';
import { studioClient } from '/@/utils/client';
import { configuration } from '/@/stores/extensionConfiguration';
import MarkdownRenderer from '/@/lib/markdown/MarkdownRenderer.svelte';
import { onMount } from 'svelte';

// eslint-disable-next-line quotes
const actionName = "Don't display anymore";

function hideGPUPromotionBanner(): void {
  studioClient.telemetryLogUsage('gpuPromotionBanner', { action: 'hide' }).catch(console.error);
  studioClient.updateExtensionConfiguration({ showGPUPromotion: false }).catch(console.error);
}

function enableGPUSupport(): void {
  studioClient.telemetryLogUsage('gpuPromotionBanner', { action: 'enable' }).catch(console.error);
  studioClient.updateExtensionConfiguration({ experimentalGPU: true }).catch(console.error);
}

onMount(() => {
  if ($configuration?.showGPUPromotion && !$configuration?.experimentalGPU) {
    studioClient.telemetryLogUsage('gpuPromotionBanner', { action: 'show' }).catch(console.error);
  }
});

const content =
  'GPU support is not enabled. Podman AI Lab supports GPU on Windows and MacOS.\n\nThis greatly enhances the developer experience when running inference servers. We recommend you to enable it.';
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
        <div class="grow">
          <MarkdownRenderer source={content} />
        </div>
        <div class="flex flex-col space-y-1">
          <Button class="w-auto ml-1" on:click={enableGPUSupport} aria-label="Enable GPU support"
            >Enable GPU support</Button>
          <Button class="w-auto ml-1" on:click={hideGPUPromotionBanner} aria-label={actionName}>{actionName}</Button>
        </div>
      </div>
    </div>
  </div>
{/if}
