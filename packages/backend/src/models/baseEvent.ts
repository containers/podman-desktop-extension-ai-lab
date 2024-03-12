/**********************************************************************
 * Copyright (C) 2024 Red Hat, Inc.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 * http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 *
 * SPDX-License-Identifier: Apache-2.0
 ***********************************************************************/

export interface BaseEvent {
  id: string;
  status: 'error' | 'completed' | 'progress' | 'canceled';
  message?: string;
}

export interface CompletionEvent extends BaseEvent {
  status: 'completed' | 'error' | 'canceled';
  duration: number;
}

export interface ProgressEvent extends BaseEvent {
  status: 'progress';
  value: number;
}

export const isCompletionEvent = (value: unknown): value is CompletionEvent => {
  return (
    !!value &&
    typeof value === 'object' &&
    'status' in value &&
    typeof value['status'] === 'string' &&
    ['canceled', 'completed', 'error'].includes(value['status'])
  );
};

export const isProgressEvent = (value: unknown): value is ProgressEvent => {
  return (
    !!value && typeof value === 'object' && 'status' in value && value['status'] === 'progress' && 'value' in value
  );
};
