<script lang="ts">
import { inferenceTypeLabel, type InferenceServer } from '@shared/models/IInference';
import Badge from '../../Badge.svelte';

export let object: InferenceServer;
</script>

<Badge content={inferenceTypeLabel(object.type)} />
