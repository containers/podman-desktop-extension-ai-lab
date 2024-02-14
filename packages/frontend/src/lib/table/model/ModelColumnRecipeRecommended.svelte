<script lang="ts">
import type { RecipeModelInfo } from '/@/models/RecipeModelInfo';
export let object: RecipeModelInfo;
</script>

{#if object.recommended}
  <i class="fas fa-star fa-xs text-gray-900" title="Recommended model"></i>
{/if}
