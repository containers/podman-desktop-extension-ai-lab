<script lang="ts">
import { onMount } from 'svelte';
import type { ModelInfo } from '@shared/models/IModelInfo';
import { type InferenceServer, InferenceType, toInferenceType } from '@shared/models/IInference';
import InferenceRuntimeSelect from '/@/lib/select/InferenceRuntimeSelect.svelte';
import { inferenceServers } from '/@/stores/inferenceServers';
import { studioClient } from '/@/utils/client';

interface Props {
  model: ModelInfo | undefined;
  // the selected runtime
  value: InferenceType | undefined;
  // if defined, restrict the runtimes to choose from (E.g. the backends supported by a recipe)
  allowed?: string[];
  // when the model is already served by an inference server, this server will be used (a single service per model)
  reuseServer?: boolean;
  disabled?: boolean;
}
let { model, value = $bindable(), allowed, reuseServer = false, disabled = false }: Props = $props();

// the runtimes having a registered provider
let providers: InferenceType[] = $state([]);

onMount(() => {
  studioClient
    .getRegisteredProviders()
    .then(registered => {
      providers = registered;
    })
    .catch((err: unknown) => {
      console.error('Something went wrong while getting the registered providers', err);
    });
});

// the runtimes the model can be run with
let runtimes: InferenceType[] = $derived(getRuntimes(model, allowed, providers));
// the inference server already serving the model
let server: InferenceServer | undefined = $derived(reuseServer ? findServer(model, $inferenceServers) : undefined);
let options: InferenceType[] = $derived(server ? [server.type] : runtimes);

$effect(() => {
  // select the preferred runtime of the model when the current one is not available
  if (!value || !options.includes(value)) {
    value = options[0];
  }
});

function getRuntimes(
  model: ModelInfo | undefined,
  allowed: string[] | undefined,
  providers: InferenceType[],
): InferenceType[] {
  // only the backends declared by the model are listed
  return (model?.backends ?? [])
    .map(backend => toInferenceType(backend))
    .filter(
      backend =>
        backend !== InferenceType.NONE && providers.includes(backend) && (!allowed || allowed.includes(backend)),
    );
}

function findServer(model: ModelInfo | undefined, servers: InferenceServer[]): InferenceServer | undefined {
  return model ? servers.find(server => server.models.some(m => m.id === model.id)) : undefined;
}
</script>

<!-- displayed when the model supports several runtimes, or is served by a runtime not available here -->
{#if runtimes.length > 1 || (server && !runtimes.includes(server.type))}
  <label for="model-runtime" class="pt-4 block mb-2 font-bold text-[var(--pd-content-card-header-text)]"
    >Model runtime</label>
  <InferenceRuntimeSelect
    bind:value={value}
    providers={options}
    disabled={disabled || !!server}
    label="Select Model Runtime" />
  {#if server}
    <span class="text-sm text-[var(--pd-content-card-text)]" role="note"
      >The model is already served by a {server.type} inference server, which will be used.</span>
  {/if}
{/if}
