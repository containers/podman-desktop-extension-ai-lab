import type { Readable } from 'svelte/store';
import { MESSAGES } from '@shared/Messages';
import { studioClient } from '/@/utils/client';
import type { LocalRepository } from '@shared/src/models/ILocalRepository';
import { RPCReadable } from '/@/stores/rpcReadable';

export const localRepositories: Readable<LocalRepository[]> = RPCReadable<LocalRepository[]>(
  [],
  [MESSAGES.MSG_LOCAL_REPOSITORY_UPDATE],
  studioClient.getLocalRepositories,
);
