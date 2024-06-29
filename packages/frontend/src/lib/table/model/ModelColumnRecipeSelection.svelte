<script lang="ts">
import { createEventDispatcher } from 'svelte';
import type { RecipeModelInfo } from '/@/models/RecipeModelInfo';
export let object: RecipeModelInfo;

const dispatch = createEventDispatcher<{ update: RecipeModelInfo }>();

export let onUpdate: () => void = () => {
  dispatch('update', object);
};

export let doUpdate: () => void = () => {
  object.inUse = true;
  onUpdate();
};
</script>

<input
  aria-label="Use this model when running the application"
  type="radio"
  checked="{object.inUse}"
  on:click="{doUpdate}" />
