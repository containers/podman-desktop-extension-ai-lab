<script lang="ts">
import type { ModelInfo } from '@shared/src/models/IModelInfo';
import ModelWhite from '../../icons/ModelWhite.svelte';
export let object: ModelInfo;
</script>

<ModelWhite solid="{!!object.file}" />
