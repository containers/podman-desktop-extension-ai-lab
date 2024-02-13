<script lang="ts">
import type { EnvironmentState } from "@shared/src/models/IEnvironmentState";
import { catalog } from '/@/stores/catalog';
import type { RecipeStatus } from "@shared/src/models/IRecipeStatus";

export let object: RecipeStatus;

$: name = $catalog.recipes.find(r => r.id === object.recipeId)?.name;
</script>

<div class="text-sm text-gray-700">
  {name}
</div>
