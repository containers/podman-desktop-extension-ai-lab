<script lang="ts">
import NavPage from '/@/lib/NavPage.svelte';
import Tab from '/@/lib/Tab.svelte';
import Route from '/@/Route.svelte';
import MarkdownRenderer from '/@/lib/markdown/MarkdownRenderer.svelte';
import type { ModelInfo } from '@shared/src/models/IModelInfo';
import { studioClient } from '../utils/client';
import { onMount } from 'svelte';
import ModelPlayground from './ModelPlayground.svelte';

export let modelId: string;
let model: ModelInfo | undefined = undefined;

onMount(async () => {
  model = await studioClient.getModelById(modelId);
})
</script>

<NavPage title="{model?.name || ''}" searchEnabled="{false}">
  <svelte:fragment slot="tabs">
    <Tab title="Summary" url="{modelId}" />
    <Tab title="Playground" url="{modelId}/playground" />
  </svelte:fragment>
  <svelte:fragment slot="content">
    <Route path="/" breadcrumb="Summary" >
      <div class="flex flex-row w-full">
        <div class="flex-grow p-5">
          <MarkdownRenderer source="{model?.description}"/>
        </div>
      </div>
    </Route>
    <Route path="/playground" breadcrumb="Playground">
      <ModelPlayground model={model} />
    </Route>

  </svelte:fragment>
</NavPage>
