<script lang="ts">
import { onMount } from 'svelte';
import { modelsMetadata } from '/@/stores/modelsMetadata';
import {
  Table,
  TableRow,
  TableColumn,
  TableSimpleColumn,
  ErrorMessage,
  LinearProgress,
} from '@podman-desktop/ui-svelte';
import { studioClient } from '/@/utils/client';

export let modelId: string;

type Item = {
  name: string;
  value: string;
};

let items: Item[] = [];
$: items;

let loading: boolean = true;
$: loading;

let error: string | undefined = undefined;
$: error;

const columns = [
  new TableColumn<Item, string>('property', {
    renderMapping: item => String(item.name),
    renderer: TableSimpleColumn,
  }),
  new TableColumn<Item, string>('value', {
    renderMapping: item => String(item.value),
    renderer: TableSimpleColumn,
  }),
];
const row = new TableRow<Item>({});

onMount(() => {
  return modelsMetadata.subscribe(metadatas => {
    const records = metadatas[modelId];
    if (records) {
      items = Object.entries(records).map(([key, value]) => ({
        name: key,
        value: String(value),
      }));
      console.log(`found ${items.length} items`);
      loading = false;
      error = undefined;
    } else {
      studioClient
        .getModelMetadata(modelId)
        .then(result => {
          modelsMetadata.set({
            ...metadatas,
            [modelId]: result,
          });
        })
        .catch((err: unknown) => {
          loading = false;
          error = `Something went wrong while fetching model metadata: ${err}`;
        });
    }
  });
});
</script>

<div class="flex flex-col grow min-h-full">
  <div class="w-full h-full flex flex-col flex-1">
    {#if loading}
      <LinearProgress />
    {/if}
    {#if error}
      <ErrorMessage error="{error}" />
    {/if}
    <Table kind="model" data="{items}" columns="{columns}" row="{row}" />
  </div>
</div>
