<script lang="ts">
import type { EnvironmentState } from '@shared/src/models/IEnvironmentState';
import { catalog } from '/@/stores/catalog';

export let object: EnvironmentState;

$: name = $catalog.recipes.find(r => r.id === object.recipeId)?.name;
</script>

<div class="text-sm text-gray-700">
  {name}
</div>
