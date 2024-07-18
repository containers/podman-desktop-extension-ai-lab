<script lang="ts">
import ApplicationActions from '../../ApplicationActions.svelte';
import type { ApplicationState } from '@shared/src/models/IApplicationState';
export let object: ApplicationState;
</script>

<ApplicationActions
  recipeId={object.recipeId}
  modelId={object.modelId}
  object={object}
  dropdownMenu={true}
  enableGoToRecipeAction={true} />
