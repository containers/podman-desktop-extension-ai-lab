<script lang="ts">
import { NavPage, Input, ErrorMessage } from '@podman-desktop/ui-svelte';
import { studioClient } from '../utils/client';
import { onDestroy, onMount } from 'svelte';
import { configuration } from '../stores/extensionConfiguration';

// The AI Lab Port is the bind value to form input
let aiLabPort: number | undefined = $state(undefined);
let invalidPort: boolean = $state(false);
let errorMsg: string | undefined = $state(undefined);

onMount(() => {
  const port = $configuration?.apiPort;
  if (port) {
    aiLabPort = port;
  } else {
    aiLabPort = 8888;
  }
});

onDestroy(async () => {
  // Set port to default one when user closes the screen if this would be done
  // in place where is invalidPort set the user would not be able to delete
  // the whole port and start from scratch
  if (invalidPort) {
    await setPortToDefaultOne();
  }
});

async function setPortToDefaultOne(): Promise<void> {
  aiLabPort = 8888;
  await studioClient.updateExtensionConfiguration({ apiPort: aiLabPort });
}

async function onAiLabPortInput(event: Event): Promise<void> {
  const raw = (event.target as HTMLInputElement).value;
  try {
    const port = parseInt(raw);
    // 0 <= port <= 65535
    if (0 <= port && port <= 65535) {
      await studioClient.updateExtensionConfiguration({ apiPort: port });
      aiLabPort = port;
      invalidPort = false;
      errorMsg = undefined;
    } else {
      errorMsg = 'An invalid port has been passed, the port must be between 0 and 65535';
      invalidPort = true;
    }
  } catch (e: unknown) {
    errorMsg = String(e);
    console.warn('invalid value for AI Lab API port', e);
    await setPortToDefaultOne();
  }
}
</script>

<NavPage title="Configurable Options" searchEnabled={false}>
  <div slot="content" class="flex flex-col min-w-full min-h-full">
    <div class="min-w-full min-h-full flex-1">
      <div class="text-[var(--pd-details-body-text)] mt-4 px-5 space-y-5" aria-label="inner-content">
        <p>
          Integrate Podman AI Lab directly into your development workflows by using its REST API endpoints. Compatible
          with Ollama's endpoints, you can seamlessly access and utilize the capabilities of Podman AI Lab without
          relying on its graphical interface.
        </p>
      </div>
      <div class="px-5 space-y-5">
        <div class="bg-[var(--pd-content-card-bg)] m-5 space-y-6 px-8 sm:pb-6 xl:pb-8 rounded-lg h-fit">
          <div class="w-full">
            <!-- aiLabPort input -->
            <label for="aiLabPort" class="pt-4 block mb-2 font-bold text-[var(--pd-content-card-header-text)]"
              >Port on which the API is listening (requires restart of extension):</label>
            <Input
              type="number"
              value={String(aiLabPort ?? 0)}
              on:input={async (e): Promise<void> => await onAiLabPortInput(e)}
              class="w-full ml-2"
              placeholder="8888"
              name="aiLabPort"
              aria-label="Port input" />
          </div>
          {#if errorMsg !== undefined}
            <ErrorMessage error={errorMsg} />
          {/if}
        </div>
      </div>
    </div>
  </div>
</NavPage>
