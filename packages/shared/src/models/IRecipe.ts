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
import type { ContainerProviderConnectionInfo } from './IContainerConnectionInfo';

export interface RecipePullOptions {
  connection?: ContainerProviderConnectionInfo;
  recipeId: string;
  modelId: string;
}

import type { InferenceServer } from './IInference';

export interface RecipeComponents {
  images: RecipeImage[];
  inferenceServer?: InferenceServer;
}

export interface RecipeImage {
  id: string;
  engineId: string;
  name?: string;
  // recipe related
  recipeId: string;
  modelService: boolean;
  ports: string[];
  appName: string;
}

export interface Recipe {
  id: string;
  name: string;
  categories: string[];
  description: string;
  icon?: string;
  repository: string;
  ref?: string;
  readme: string;
  basedir?: string;
  recommended?: string[];
  /**
   * The backend field aims to target which inference
   * server the recipe requires
   */
  backend?: string;
}
