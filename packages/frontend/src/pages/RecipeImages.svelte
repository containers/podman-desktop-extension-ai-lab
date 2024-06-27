<script lang="ts">
import type { Recipe, RecipeImage } from '@shared/src/models/IRecipe';
import { recipeImages } from '/@/stores/recipeImages';
import { Table, TableRow, TableColumn, TableSimpleColumn } from '@podman-desktop/ui-svelte';
import ImageColumnIcon from '/@/lib/table/images/ImageColumnIcon.svelte';

export let recipe: Recipe;

let images: RecipeImage[] = [];
$: images = $recipeImages.filter(image => image.recipeId === recipe.id);

const columns = [
  new TableColumn<RecipeImage>('', {
    width: '40px',
    renderer: ImageColumnIcon,
  }),
  new TableColumn<RecipeImage, string>('Name', {
    width: '3fr',
    renderer: TableSimpleColumn,
    renderMapping: (object) => object.id,
  }),
];
const row = new TableRow<RecipeImage>({});
</script>

{#if images.length > 0}
  <Table kind="model" data="{images}" columns="{columns}" row="{row}"></Table>
{:else}
  <div role="status" class="text-[var(--pd-content-text)]">There are no images yet. Build the recipe to see the corresponding image here.</div>
{/if}
