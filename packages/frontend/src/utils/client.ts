import type { StudioAPI } from '@shared/src/StudioAPI';
import { RpcBrowser } from '@shared/src/messages/MessageProxy';
import type { RouterState } from '/@/models/IRouterState';

export const RECENT_CATEGORY_ID = 'recent-category';
const podmanDesktopApi = acquirePodmanDesktopApi();
export const rpcBrowser: RpcBrowser = new RpcBrowser(window, podmanDesktopApi);

export const studioClient: StudioAPI = rpcBrowser.getProxy<StudioAPI>();

export const saveRouterState = (state: RouterState) => {
  podmanDesktopApi.setState(state);
};

const isRouterState = (value: unknown): value is RouterState => {
  return typeof value === 'object' && !!value && 'url' in value;
};

export const getRouterState = (): RouterState => {
  const state = podmanDesktopApi.getState();
  if (isRouterState(state)) return state;
  return { url: '/' };
};
