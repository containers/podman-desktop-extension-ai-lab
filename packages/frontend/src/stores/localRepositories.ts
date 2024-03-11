import type { Readable } from 'svelte/store';
import { Messages } from '@shared/Messages';
import { studioClient } from '/@/utils/client';
import type { LocalRepository } from '@shared/src/models/ILocalRepository';
import { RPCReadable } from '/@/stores/rpcReadable';

export const localRepositories: Readable<LocalRepository[]> = RPCReadable<LocalRepository[]>(
  [],
  [Messages.MSG_LOCAL_REPOSITORY_UPDATE],
  studioClient.getLocalRepositories,
);
