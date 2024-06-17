<script lang="ts">
import ModelColumnName from '/@/lib/table/model/ModelColumnName.svelte';
import ModelColumnRecipeSelection from '../lib/table/model/ModelColumnRecipeSelection.svelte';
import ModelColumnRecipeRecommended from '../lib/table/model/ModelColumnRecipeRecommended.svelte';
import ModelColumnIcon from '/@/lib/table/model/ModelColumnIcon.svelte';
import { Table, TableColumn, TableRow } from '@podman-desktop/ui-svelte';
import type { ModelInfo } from '@shared/src/models/IModelInfo';

export let models: ModelInfo[];
export let recommended: string[];
export let selected: string;
export let setSelectedModel: (modelId: string) => void;

$: models = models.map((m, i) => {
  return {
    ...m,
    inUse: m.id === selected,
  };
});

const columns = [
  new TableColumn<ModelInfo>('', { width: '20px', renderer: ModelColumnRecipeSelection }),
  new TableColumn<ModelInfo, boolean>('', {
    width: '20px',
    renderer: ModelColumnRecipeRecommended,
    renderMapping: object => recommended.includes(object.id),
  }),
  new TableColumn<ModelInfo>('', { width: '32px', renderer: ModelColumnIcon }),
  new TableColumn<ModelInfo>('Name', { width: '4fr', renderer: ModelColumnName }),
];
const row = new TableRow<ModelInfo>({});

function setModelToUse(selected: ModelInfo) {
  setSelectedModel(selected.id);
}
</script>

<div class="flex flex-col grow min-h-full">
  <div class="w-full min-h-full flex-1">
    <div class="h-full">
      <Table kind="model" data="{models}" columns="{columns}" row="{row}" on:update="{e => setModelToUse(e.detail)}" />
    </div>
  </div>
</div>
