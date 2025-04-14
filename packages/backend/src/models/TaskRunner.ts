/**********************************************************************
 * Copyright (C) 2025 Red Hat, Inc.
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

export interface RunAsTaskOptions {
  loadingLabel: string;
  // label set when the task terminates normally, by default the loading label is kept
  successLabel?: string;
  // label set when the task terminates in error, by default the loading label is kept
  errorLabel?: string;
  // the error message to display when task terminates in error
  errorMsg: (err: unknown) => string;
  // if true, all subtasks (tasks found with the same labels) will be immediately marked in error if this task fails
  failFastSubtasks?: boolean;
}

export interface TaskRunnerTools {
  updateLabels: (f: (labels: Record<string, string>) => Record<string, string>) => void;
}
