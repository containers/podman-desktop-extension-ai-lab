import type { Readable } from 'svelte/store';
import { MSG_LOCAL_REPOSITORY_UPDATE } from '@shared/Messages';
import { studioClient } from '/@/utils/client';
import type { LocalRepository } from '@shared/models/ILocalRepository';
import { RPCReadable } from '/@/stores/rpcReadable';

export const localRepositories: Readable<LocalRepository[]> = RPCReadable<LocalRepository[]>(
  [],
  MSG_LOCAL_REPOSITORY_UPDATE,
  studioClient.getLocalRepositories,
);
