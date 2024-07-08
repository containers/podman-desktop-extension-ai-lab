<script lang="ts">
import MarkdownRenderer from '/@/lib/markdown/MarkdownRenderer.svelte';
import { catalog } from '/@/stores/catalog';
import { DetailsPage } from '@podman-desktop/ui-svelte';
import { router } from 'tinro';
import { Tab } from '@podman-desktop/ui-svelte';
import Route from '/@/Route.svelte';
import ModelInspect from '/@/pages/ModelInspect.svelte';
import { InferenceType } from '@shared/src/models/IInference';

export let modelId: string;

$: model = $catalog.models.find(m => m.id === modelId);

export function goToUpPage(): void {
  router.goto('/models');
}
</script>

<DetailsPage
  title="{model?.name || ''}"
  breadcrumbLeftPart="Models"
  breadcrumbRightPart="{model?.name || ''}"
  breadcrumbTitle="Go back to Models"
  on:close="{goToUpPage}"
  on:breadcrumbClick="{goToUpPage}">
  <svelte:fragment slot="tabs">
    {#if model?.backend === InferenceType.LLAMA_CPP}
      <Tab title="Summary" url="/model/{modelId}" selected="{$router.path === `/model/${modelId}`}" />
      <Tab title="Inspect" url="/model/{modelId}/inspect" selected="{$router.path === `/model/${modelId}/inspect`}" />
    {/if}
  </svelte:fragment>
  <svelte:fragment slot="content">
      <div class="flex flex-row w-full h-full bg-[var(--pd-content-bg)] overflow-y-auto">
        <Route path="/">
          <div class="flex-grow p-5">
            <MarkdownRenderer source="{model?.description}" />
          </div>
        </Route>
        <Route path="/inspect">
          <ModelInspect modelId="{modelId}"/>
        </Route>
      </div>
  </svelte:fragment>
</DetailsPage>
