import type { StudioAPI } from '@shared/StudioAPI';
import { RpcBrowser } from '@shared/MessageProxy';
import type { ModelInfo } from '@shared/models/IModelInfo';

export const RECENT_CATEGORY_ID = 'recent-category';
const podmanDesktopApi = acquirePodmanDesktopApi();
const rpcBrowser: RpcBrowser = new RpcBrowser(window, podmanDesktopApi);

export const studioClient: StudioAPI = rpcBrowser.getProxy<StudioAPI>();
/*      {
          id: 'stable-diffusion-xl-base-1.0',
          file: 'stable-diffusion-xl-base-1.0.model'
      },
      {
          id: 'albedobase-xl-1.3',
          file: 'albedobase-xl-1.3.model'
      },
*/