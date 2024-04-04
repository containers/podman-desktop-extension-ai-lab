<script lang="ts">
import { inferenceServers } from '/@/stores/inferenceServers';
import NavPage from '/@/lib/NavPage.svelte';
import ServiceStatus from '/@/lib/table/service/ServiceStatus.svelte';
import ServiceAction from '/@/lib/table/service/ServiceAction.svelte';
import Fa from 'svelte-fa';
import { faBuildingColumns, faMicrochip, faScaleBalanced } from '@fortawesome/free-solid-svg-icons';
import type { InferenceServer } from '@shared/src/models/IInference';
import { snippetLanguages } from '/@/stores/snippetLanguages';
import type { LanguageVariant } from 'postman-code-generators';
import { studioClient } from '/@/utils/client';
import { onMount } from 'svelte';
import { router } from 'tinro';

export let containerId: string | undefined = undefined;

let service: InferenceServer | undefined = undefined;

let selectedLanguage: string = 'curl';
$: selectedLanguage;

let variants: LanguageVariant[] = [];
$: variants = $snippetLanguages.find(language => language.key === selectedLanguage)?.variants || [];

let selectedVariant: string = 'cURL';
$: selectedVariant;

const onLanguageChange = (): void => {
  if (variants.length > 0) {
    selectedVariant = variants[0].key;
    generate(selectedLanguage, selectedVariant);
  }
};

let snippet: string | undefined = undefined;
$: snippet;

const generate = async (language: string, variant: string) => {
  snippet = await studioClient.createSnippet(
    {
      url: `http://localhost:${service?.connection.port || '??'}/v1/chat/completions`,
      method: 'POST',
      header: [
        {
          key: 'Content-Type',
          value: 'application/json',
        },
      ],
      body: {
        mode: 'raw',
        raw: `{
  "messages": [
    {
      "content": "You are a helpful assistant.",
      "role": "system"
    },
    {
      "content": "What is the capital of France?",
      "role": "user"
    }
  ]
}`,
      },
    },
    language,
    variant,
  );
};

$: {
  if (!snippet && service) {
    generate('curl', 'cURL');
  }
}

onMount(() => {
  return inferenceServers.subscribe(servers => {
    service = servers.find(server => server.container.containerId === containerId);
    if (!service) {
      router.goto('/services');
    }
  });
});
</script>

<NavPage lastPage="{{ name: 'Model Services', path: '/services' }}" title="Service Details" searchEnabled="{false}">
  <svelte:fragment slot="content">
    <div slot="content" class="flex flex-col min-w-full min-h-full">
      <div class="min-w-full min-h-full flex-1">
        <div class="mt-4 px-5 space-y-5">
          {#if service !== undefined}
            <!-- container details -->
            <div class="bg-charcoal-800 rounded-md w-full px-4 pt-2 pb-4">
              <!-- container info -->
              <span class="text-sm">Container</span>
              <div class="w-full bg-charcoal-600 rounded-md p-2 flex items-center">
                <div class="grow ml-2 flex flex-row">
                  {#key service.health?.Status}
                    <ServiceStatus object="{service}" />
                  {/key}
                  <div class="flex flex-col text-xs ml-2 items-center justify-center">
                    <span>{service.container.containerId}</span>
                  </div>
                </div>
                <ServiceAction object="{service}" />
              </div>

              <!-- models info -->
              <div class="mt-4">
                <span class="text-sm">Models</span>
                <div class="w-full bg-charcoal-600 rounded-md p-2 flex flex-col gap-y-4">
                  {#each service.models as model}
                    <div class="flex flex-row gap-2 items-center">
                      <div class="grow text-sm">{model.name}</div>
                      <div>
                        <div
                          class="bg-charcoal-800 rounded-md p-2 flex flex-row w-min h-min text-xs text-charcoal-100 text-nowrap items-center">
                          <Fa class="mr-2" icon="{faScaleBalanced}" />
                          {model.license}
                        </div>
                      </div>
                      <div>
                        <div
                          class="bg-charcoal-800 rounded-md p-2 flex flex-row w-min h-min text-xs text-charcoal-100 text-nowrap items-center">
                          <Fa class="mr-2" icon="{faBuildingColumns}" />
                          {model.registry}
                        </div>
                      </div>
                    </div>
                  {/each}
                </div>
              </div>
            </div>

            <!-- server details -->
            <div class="bg-charcoal-800 rounded-md w-full px-4 pt-2 pb-4 mt-2">
              <span class="text-sm">Server</span>
              <div class="flex flex-row gap-4">
                <div class="bg-charcoal-600 rounded-md p-2 flex flex-row w-min h-min text-xs text-nowrap items-center">
                  http://localhost:{service.connection.port}/v1
                </div>

                <div class="bg-charcoal-600 rounded-md p-2 flex flex-row w-min h-min text-xs text-nowrap items-center">
                  CPU Inference
                  <Fa class="ml-2" icon="{faMicrochip}" />
                </div>
              </div>
            </div>

            <!-- code client -->
            <div>
              <div class="flex flex-row">
                <span class="text-base grow">Client code</span>

                <!-- language choice -->
                <select
                  required
                  aria-label="snippet language selection"
                  bind:value="{selectedLanguage}"
                  on:change="{onLanguageChange}"
                  id="languages"
                  class="border text-sm rounded-lg focus:ring-purple-500 focus:border-purple-500 block p-1 bg-charcoal-900 border-charcoal-900 placeholder-gray-700 text-white"
                  name="languages">
                  {#each $snippetLanguages as language}
                    <option class="my-1" value="{language.key}">{language.label}</option>
                  {/each}
                </select>
                {#if selectedVariant !== undefined}
                  <select
                    required
                    aria-label="snippet language variant"
                    id="variants"
                    bind:value="{selectedVariant}"
                    on:change="{() => generate(selectedLanguage, selectedVariant)}"
                    disabled="{variants.length === 1}"
                    class="border ml-1 text-sm rounded-lg focus:ring-purple-500 focus:border-purple-500 block p-1 bg-charcoal-900 border-charcoal-900 placeholder-gray-700 text-white"
                    name="variants">
                    {#each variants as variant}
                      <option class="my-1" value="{variant.key}">{variant.key}</option>
                    {/each}
                  </select>
                {/if}
              </div>

              {#if snippet !== undefined}
                <div class="bg-charcoal-900 rounded-md w-full p-4 mt-2">
                  <code class="whitespace-break-spaces">
                    {snippet}
                  </code>
                </div>
              {/if}
            </div>
          {/if}
        </div>
      </div>
    </div>
  </svelte:fragment>
</NavPage>
