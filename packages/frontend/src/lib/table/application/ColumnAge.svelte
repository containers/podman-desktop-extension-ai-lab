<script lang="ts">
import moment from 'moment';
import { humanizeAge } from '/@/utils/dimensions';
import type { ApplicationState } from '@shared/models/IApplicationState';

export let object: ApplicationState;
</script>

<div class="text-[var(--pd-table-body-text)] overflow-hidden text-ellipsis">
  {humanizeAge(moment(object.pod.Created).unix())}
</div>
