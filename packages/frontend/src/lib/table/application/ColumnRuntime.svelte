<script lang="ts">
import type { ApplicationState } from '@shared/models/IApplicationState';
import Badge from '../../Badge.svelte';
import { inferenceTypeLabel } from '@shared/models/IInference';

export let object: ApplicationState;
</script>

<Badge content={inferenceTypeLabel(object.backend)} />
