<script lang="ts">
import type { EnvironmentCell } from '/@/pages/environments';
import { catalog } from '/@/stores/catalog';

export let object: EnvironmentCell;

$: name = $catalog.recipes.find(r => r.id === object.recipeId)?.name;
</script>

<div class="text-sm text-gray-700">
  {name}
</div>
