<script lang="ts">
  import { recipeStatusMap, type RecipeStatus } from "@shared/src/models/IRecipeStatus";
  export let object: RecipeStatus;
</script>

<div class="text-sm text-gray-700">
  {recipeStatusMap[object.state]}
</div>
