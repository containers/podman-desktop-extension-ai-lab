<script lang="ts">
  import type { ModelInfo } from '@shared/src/models/IModelInfo';
  import type { ModelResponseChoice } from '@shared/src/models/IModelResponse';
  import Button from '../lib/button/Button.svelte';
  import { onMount } from 'svelte';
  import { studioClient } from '../utils/client';
  import { playgroundQueries } from '../stores/playground-queries';
  import type { QueryState } from '@shared/src/models/IPlaygroundQueryState';
  import { playgroundStates } from '/@/stores/playground-states';
  import type { PlaygroundState } from '@shared/src/models/IPlaygroundState';
  import Card from '/@/lib/Card.svelte';
  export let model: ModelInfo | undefined;
  import Fa from 'svelte-fa';
  import { faPlay, faStop, faInfo, faWarning } from '@fortawesome/free-solid-svg-icons';
  import ContainerIcon from '/@/lib/images/ContainerIcon.svelte';
  import ErrorMessage from '/@/lib/ErrorMessage.svelte';

  let prompt = '';
  let queryId: number;
  let result: ModelResponseChoice | undefined = undefined;
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
      console.log('playgroundStates update', states);
      playgroundState = states.find((state) => state.modelId === model.id);
      if(playgroundState === undefined) {
        playgroundState = { modelId: model.id,  status: 'none' };
      }
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
      inProgress = false;
      prompt = query.prompt;
      if (query.response?.choices.length) {
        result = query.response?.choices[0];
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
    result = undefined;
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
    if(playgroundState === undefined)
      return;

    switch (playgroundState.status) {
      case "none":
      case "stopped":
        studioClient.startPlayground(model.id);
        break;
      case "running":
        studioClient.stopPlayground(model.id);
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
      bind:value={result.text}
      class="w-full p-2 outline-none text-sm bg-charcoal-800 rounded-sm text-gray-700 placeholder-gray-700"></textarea>
  {/if}
</div>

