import type { StudioAPI } from '@shared/src/StudioAPI';
import { RpcBrowser } from '@shared/src/MessageProxy';

export const RECENT_CATEGORY_ID = 'recent-category';
const podmanDesktopApi = acquirePodmanDesktopApi();
const rpcBrowser: RpcBrowser = new RpcBrowser(window, podmanDesktopApi);

export const studioClient: StudioAPI = rpcBrowser.getProxy<StudioAPI>();
