import type { StudioAPI } from '@shared/StudioAPI';
import { RpcBrowser } from '@shared/MessageProxy';
import type { ModelInfo } from '@shared/models/IModelInfo';

export const RECENT_CATEGORY_ID = 'recent-category';
const podmanDesktopApi = acquirePodmanDesktopApi();
const rpcBrowser: RpcBrowser = new RpcBrowser(window, podmanDesktopApi);

export const studioClient: StudioAPI = rpcBrowser.getProxy<StudioAPI>();
