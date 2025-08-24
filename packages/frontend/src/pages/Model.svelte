<script lang="ts">
import MarkdownRenderer from '/@/lib/markdown/MarkdownRenderer.svelte';
import { catalog } from '/@/stores/catalog';
import { DetailsPage } from '@podman-desktop/ui-svelte';
import { router } from 'tinro';
import ModelStatusIcon from '/@/lib/icons/ModelStatusIcon.svelte';

export let modelId: string;

$: model = $catalog.models.find(m => m.id === modelId);

export function goToUpPage(): void {
  router.goto('/models');
}
</script>

<DetailsPage
  title={model?.name ?? modelId}
  breadcrumbLeftPart="Models"
  breadcrumbRightPart={model?.name ?? ''}
  onclose={goToUpPage}
  onbreadcrumbClick={goToUpPage}>
  {#snippet iconSnippet()}
    {#if model}
      <div class="mr-3">
        <ModelStatusIcon object={model} />
      </div>
    {/if}
  {/snippet}
  {#snippet contentSnippet()}
    <div class="flex flex-row w-full h-full bg-[var(--pd-content-bg)] overflow-y-auto">
      <div class="grow p-5">
        <MarkdownRenderer source={model?.description} />
      </div>
    </div>
  {/snippet}
</DetailsPage>
