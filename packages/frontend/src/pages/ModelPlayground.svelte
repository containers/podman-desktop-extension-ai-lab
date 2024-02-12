<script lang="ts">
  import type { ModelInfo } from '@shared/src/models/IModelInfo';
  import Button from '../lib/button/Button.svelte';
  import { onMount } from 'svelte';
  import { studioClient } from '../utils/client';
  import { playgroundQueries } from '../stores/playground-queries';
  import type { QueryState } from '@shared/src/models/IPlaygroundQueryState';
  import { playgroundStates } from '/@/stores/playground-states';
  import type { PlaygroundState } from '@shared/src/models/IPlaygroundState';
  import Card from '/@/lib/Card.svelte';
  export let model: ModelInfo | undefined;
  import { faPlay, faStop, faInfo, faWarning } from '@fortawesome/free-solid-svg-icons';
  import ContainerIcon from '/@/lib/images/ContainerIcon.svelte';
  import ErrorMessage from '/@/lib/ErrorMessage.svelte';

  let prompt = '';
  let queryId: number;
  $: result = '';
  let inProgress = false;
  let error: string | undefined = undefined;
  let playgroundState: PlaygroundState | undefined = undefined;

  onMount(() => {
    if (!model) {
      return;
    }

    const unsubscribeQueries = playgroundQueries.subscribe((queries: QueryState[]) => {
      if (queryId === -1) {
        return;
      }
      let myQuery = queries.find(q => q.id === queryId);
      if (!myQuery) {
        myQuery = queries.findLast(q => q.modelId === model?.id);
      }
      if (!myQuery) {
        return;
      }
      displayQuery(myQuery);
    });

    const unsubscribeStates = playgroundStates.subscribe((states: PlaygroundState[]) => {
      playgroundState = states.find((state) => state.modelId === model.id);
      if(playgroundState === undefined) {
        playgroundState = { modelId: model.id,  status: 'none' };
      }
      error = playgroundState.error ?? error;
    })

    return () => {
      unsubscribeQueries();
      unsubscribeStates();
    };
  });

  function displayQuery(query: QueryState) {
    if(query.error) {
      error = query.error;
      inProgress = false;
      return;
    }

    if (query.response) {
      inProgress = !query.response.choices.some(choice => choice.finish_reason);
      prompt = query.prompt;
      if (query.response?.choices.length) {
        result = query.response?.choices.map(choice => choice.text).join('');
      }
    } else {
      inProgress = true;
      prompt = query.prompt;
      queryId = query.id;
    }
  }

  async function askPlayground() {
    if (!model) {
      return;
    }
    inProgress = true;
    result = '';
    error = undefined;

    // do not display anything before we get a response from askPlayground
    // (we can receive a new queryState before the new QueryId)
    queryId = -1;
    queryId = await studioClient.askPlayground(model.id, prompt);
  }

  const getActionIcon = () => {
    if(playgroundState === undefined)
      return faWarning;

    switch (playgroundState.status) {
      case "none":
      case "stopped":
        return faPlay;
      case "running":
        return faStop
      case "starting":
      case "stopping":
        return faInfo;
      case "error":
        return faWarning;
    }
  }

  const onAction = () => {
    if(playgroundState === undefined || model?.id === undefined)
      return;

    switch (playgroundState.status) {
      case "none":
      case "stopped":
        studioClient.startPlayground(model.id).catch((err: unknown) => {
          error = `Something went wrong while trying to start playground: ${String(err)}`;
        });
        break;
      case "running":
        studioClient.stopPlayground(model.id).catch((err: unknown) => {
          error = `Something went wrong while trying to stop playground: ${String(err)}`;
        });
        break;
      case "starting":
      case "stopping":
        return faInfo;
      case "error":
        return faWarning;
    }
  }

  const isPromptable = () => {
    if(playgroundState === undefined)
      return false;

    switch (playgroundState.status) {
      case "none":
      case "stopped":
      case "error":
      case "starting":
      case "stopping":
        return false;
      case "running":
        return true;
    }
  }

  const isLoading = () => {
    if(playgroundState === undefined)
      return true;

    switch (playgroundState.status) {
      case "none":
      case "stopped":
      case "running":
      case "error":
        return false;
      case "starting":
      case "stopping":
        return true;
    }
  }

  const navigateToContainer = () => {
    if(playgroundState?.container?.containerId === undefined)
      return;

    try {
      studioClient.navigateToContainer(playgroundState?.container?.containerId);
    } catch(err) {
      console.error(err);
    }
  }
</script>

<div class="m-4 w-full flew flex-col">
  {#if error}
    <div class="mb-2">
      <ErrorMessage error="{error}"/>
    </div>
  {/if}
  <Card classes="bg-charcoal-800">
    <div slot="content" class="my-2 mx-4 w-full text-base font-normal flex flex-row items-center">
      {#key playgroundState?.status}
        <span class="flex-grow">Playground {playgroundState?.status}</span>
        <Button title="playground-action" inProgress={isLoading()} on:click={onAction} icon="{getActionIcon()}"/>
        {#if playgroundState?.container}
          <Button class="ml-2" on:click={navigateToContainer} title="navigate-to-container" icon="{ContainerIcon}"/>
        {/if}
      {/key}
    </div>
  </Card>
  <div class="mb-2">Prompt</div>
  <textarea
    aria-label="prompt"
    bind:value={prompt}
    rows="4"
    class="w-full p-2 outline-none text-sm bg-charcoal-800 rounded-sm text-gray-700 placeholder-gray-700"
    placeholder="Type your prompt here"></textarea>

  <div class="mt-4 text-right">
    {#key playgroundState?.status}
      <Button disabled={!isPromptable()} inProgress={inProgress} on:click={() => askPlayground()}>Send Request</Button>
    {/key}
  </div>

  {#if result}
    <div class="mt-4 mb-2">Output</div>
    <textarea
      aria-label="response"
      readonly
      disabled
      rows="20"
      bind:value={result}
      class="w-full p-2 outline-none text-sm bg-charcoal-800 rounded-sm text-gray-700 placeholder-gray-700"></textarea>
  {/if}
</div>

