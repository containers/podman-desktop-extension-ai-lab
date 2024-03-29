<script lang="ts">
import moment from 'moment';
import { humanizeAge } from '/@/utils/dimensions';
import type { ApplicationState } from '@shared/src/models/IApplicationState';

export let object: ApplicationState;
</script>

<div class="text-sm text-gray-700 overflow-hidden text-ellipsis">
  {humanizeAge(moment(object.pod.Created).unix())}
</div>
