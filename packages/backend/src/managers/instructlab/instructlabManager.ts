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

import type { InstructlabSession } from '@shared/src/models/instructlab/IInstructlabSession';

export class InstructlabManager {
  public getSessions(): InstructlabSession[] {
    return [
      {
        name: 'session 1',
        modelId: 'hf.facebook.detr-resnet-101',
        targetModel: 'hf.facebook.detr-resnet-101-target',
        repository: '/a1',
        status: 'fine-tuned',
        createdTime: new Date(new Date().getTime() - 6 * 24 * 60 * 60 * 1000).getTime() / 1000, // 6 days ago
      },
      {
        name: 'session 2',
        modelId: 'hf.ibm-granite.granite-8b-code-instruct',
        targetModel: 'hf.ibm-granite.granite-8b-code-instruct-target',
        repository: '/a2',
        status: 'generating-instructions',
        createdTime: new Date(new Date().getTime() - 4 * 60 * 60 * 1000).getTime() / 1000, // 4 hours ago
      },
    ];
  }
}
