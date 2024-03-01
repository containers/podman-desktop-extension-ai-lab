<script lang="ts">
import ApplicationActions from '../../ApplicationActions.svelte';
import type { ApplicationCell } from '../../../pages/applications';
export let object: ApplicationCell;
</script>

<ApplicationActions recipeId="{object.recipeId}" modelId="{object.modelId}" object="{object.envState}" />
