<script lang="ts">
import type { EnvironmentState } from "@shared/src/models/IEnvironmentState";
import EnvironmentControls from "../../EnvironmentControls.svelte";
export let object: EnvironmentState;
</script>

<EnvironmentControls recipeId={object.recipeId} {object} />
