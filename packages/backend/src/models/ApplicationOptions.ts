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

import type { ContainerProviderConnection } from '@podman-desktop/api';
import type { ModelInfo } from '@shared/models/IModelInfo';
import type { Recipe, RecipeDependencies } from '@shared/models/IRecipe';

export type ApplicationOptions = ApplicationOptionsDefault | ApplicationOptionsWithModelInference;

export interface ApplicationOptionsDefault {
  connection: ContainerProviderConnection;
  recipe: Recipe;
  dependencies?: RecipeDependencies;
}

export type ApplicationOptionsWithModelInference = ApplicationOptionsDefault & {
  model: ModelInfo;
};

export function isApplicationOptionsWithModelInference(
  options: ApplicationOptions,
): options is ApplicationOptionsWithModelInference {
  return 'model' in options;
}
