<script lang="ts">
import moment from 'moment';
import type { EnvironmentCell } from '/@/pages/environments';
import { catalog } from '/@/stores/catalog';
import { humanizeAge } from '/@/utils/dimensions';

export let object: EnvironmentCell;
</script>

<div class="text-sm text-gray-700 overflow-hidden text-ellipsis">
  {humanizeAge(moment(object.envState.pod.Created).unix())}
</div>
