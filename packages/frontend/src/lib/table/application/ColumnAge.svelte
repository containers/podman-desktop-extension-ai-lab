<script lang="ts">
import moment from 'moment';
import type { ApplicationCell } from '../../../pages/applications';
import { catalog } from '/@/stores/catalog';
import { humanizeAge } from '/@/utils/dimensions';

export let object: ApplicationCell;
</script>

<div class="text-sm text-gray-700 overflow-hidden text-ellipsis">
  {humanizeAge(moment(object.appState.pod.Created).unix())}
</div>
