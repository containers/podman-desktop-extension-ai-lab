<script lang="ts">
import { getIcon } from '/@/utils/categoriesUtils.js';
import Card from '/@/lib/Card.svelte';
import type { Recipe } from '@shared/src/models/IRecipe';

export let background: string = 'bg-charcoal-700';
export let backgroundHover: string = 'hover:bg-charcoal-500';

export let recipe: Recipe;
export let displayDescription: boolean = true;
</script>

<Card
  href="/recipe/{recipe.id}"
  title="{recipe.name}"
  description="{displayDescription ? recipe.description : ''}"
  icon="{getIcon(recipe.icon)}"
  classes="{background} {backgroundHover} flex-grow p-4 h-full" />
