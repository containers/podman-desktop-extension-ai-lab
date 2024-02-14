<script lang="ts">
import { createEventDispatcher } from 'svelte';
import type { RecipeModelInfo } from '/@/models/RecipeModelInfo';
export let object: RecipeModelInfo;

const dispatch = createEventDispatcher<{ update: RecipeModelInfo }>();

function selectModel() {
  object.inUse = true;
  dispatch('update', object);
}
</script>

<input
  aria-label="Use this model when running the application"
  type="radio"
  checked="{object.inUse}"
  on:click="{selectModel}" />
