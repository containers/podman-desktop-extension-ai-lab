/**********************************************************************
 * Copyright (C) 2024-2025 Red Hat, Inc.
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

import type { ModelInfo } from './models/IModelInfo';
import type { ApplicationCatalog } from './models/IApplicationCatalog';
import type { OpenDialogOptions, Uri } from '@podman-desktop/api';
import type { ApplicationState } from './models/IApplicationState';
import type { Task } from './models/ITask';
import type { LocalRepository } from './models/ILocalRepository';
import type { InferenceServer } from './models/IInference';
import type { RequestOptions } from './models/RequestOptions';
import type { Language } from 'postman-code-generators';
import type { CreationInferenceServerOptions } from './models/InferenceServerConfig';
import type { ModelOptions } from './models/IModelOptions';
import type { Conversation } from './models/IPlaygroundMessage';
import type { LocalModelImportInfo } from './models/ILocalModelInfo';
import type {
  CheckContainerConnectionResourcesOptions,
  ContainerConnectionInfo,
  ContainerProviderConnectionInfo,
} from './models/IContainerConnectionInfo';
import type { ExtensionConfiguration } from './models/IExtensionConfiguration';
import type { RecipePullOptions } from './models/IRecipe';
import type { FilterRecipesResult, RecipeFilters } from './models/FilterRecipesResult';
import { createRpcChannel } from './messages/MessageProxy';

export const STUDIO_API_CHANNEL = createRpcChannel<StudioAPI>('StudioAPI');
export interface StudioAPI {
  ping(): Promise<string>;
  getCatalog(): Promise<ApplicationCatalog>;
  filterRecipes(filters: RecipeFilters): Promise<FilterRecipesResult>;

  // Application related methods
  /**
   * Clone a recipe
   * @param recipeId
   */
  cloneApplication(recipeId: string): Promise<void>;

  /**
   * Allow the frontend to get a list of the container provider connections available.
   * This object can be used in requestPullApplication
   */
  getContainerProviderConnection(): Promise<ContainerProviderConnectionInfo[]>;
  /**
   * Pull an application (clone, download model, build container, start pod)
   *
   * @return a promise with a tracking id used in each task labels
   * @param options
   */
  requestPullApplication(options: RecipePullOptions): Promise<string>;
  requestStopApplication(recipeId: string, modelId: string): Promise<void>;
  requestStartApplication(recipeId: string, modelId: string): Promise<void>;
  requestRemoveApplication(recipeId: string, modelId: string): Promise<void>;
  requestRestartApplication(recipeId: string, modelId: string): Promise<void>;
  requestOpenApplication(recipeId: string, modelId: string): Promise<void>;
  getApplicationsState(): Promise<ApplicationState[]>;

  openURL(url: string): Promise<boolean>;
  openFile(file: string, recipeId?: string): Promise<boolean>;
  openDialog(options?: OpenDialogOptions): Promise<Uri[] | undefined>;

  /**
   * Get the information of models saved locally into the user's directory
   */
  getModelsInfo(): Promise<ModelInfo[]>;

  /**
   * Given a modelId will return the model metadata
   * @remark If the model is not available locally, a fetch request will be used to get its metadata from the header.
   * @param modelId
   */
  getModelMetadata(modelId: string): Promise<Record<string, unknown>>;

  /**
   * Delete the folder containing the model from local storage
   */
  requestRemoveLocalModel(modelId: string): Promise<void>;

  getModelsDirectory(): Promise<string>;

  navigateToContainer(containerId: string): Promise<void>;
  navigateToPod(podId: string): Promise<void>;
  navigateToResources(): Promise<void>;
  navigateToEditConnectionProvider(connectionName: string): Promise<void>;

  telemetryLogUsage(eventName: string, data?: Record<string, unknown>): Promise<void>;
  telemetryLogError(eventName: string, data?: Record<string, unknown>): Promise<void>;

  getLocalRepositories(): Promise<LocalRepository[]>;

  getTasks(): Promise<Task[]>;

  /**
   * Open the VSCode editor
   * @param directory the directory to open the editor from
   */
  openVSCode(directory: string, recipeId?: string): Promise<void>;

  /**
   * Download a model from the catalog
   * @param modelId the id of the model we want to download
   */
  downloadModel(modelId: string): Promise<void>;

  /**
   * Get inference servers
   */
  getInferenceServers(): Promise<InferenceServer[]>;

  /**
   * Request to start an inference server
   * @param options The options to use
   *
   * @return a tracking identifier to follow progress
   */
  requestCreateInferenceServer(options: CreationInferenceServerOptions): Promise<string>;

  /**
   * Start an inference server
   * @param containerId the container id of the inference server
   */
  startInferenceServer(containerId: string): Promise<void>;

  /**
   * Stop an inference server
   * @param containerId the container id of the inference server
   */
  stopInferenceServer(containerId: string): Promise<void>;

  /**
   * Delete an inference server container
   * @param containerIds ids of the container to delete
   */
  requestDeleteInferenceServer(...containerIds: string[]): Promise<void>;

  /**
   * Return a free random port on the host machine
   */
  getHostFreePort(): Promise<number>;

  /**
   * Submit a user input to the Playground linked to a conversation, model, and inference server
   * @param containerId the container id of the inference server we want to use
   * @param modelId the model to use
   * @param conversationId the conversation to input the message in
   * @param userInput the user input, e.g. 'What is the capital of France ?'
   * @param options the options for the model, e.g. temperature
   */
  submitPlaygroundMessage(containerId: string, userInput: string, options?: ModelOptions): Promise<number>;

  /**
   * Given a conversation, update the system prompt.
   * If none exists, it will create one, otherwise it will replace the content with the new one
   * @param conversationId the conversation id to set the system id
   * @param content the new system prompt to use
   */
  setPlaygroundSystemPrompt(conversationId: string, content: string | undefined): Promise<void>;

  /**
   * Return the conversations
   */
  getPlaygroundConversations(): Promise<Conversation[]>;

  /**
   * Get the extension configuration (preferences)
   */
  getExtensionConfiguration(): Promise<ExtensionConfiguration>;
  updateExtensionConfiguration(update: Partial<ExtensionConfiguration>): Promise<void>;

  /**
   * Get the PD version
   */
  abstract getPDVersion(): Promise<string>;

  /**
   * Return the list of supported languages to generate code from.
   */
  getSnippetLanguages(): Promise<Language[]>;

  /**
   * return a code snippet as a string matching the arguments and options provided
   * @param options the options for the request
   * @param language the language to use
   * @param variant the variant of the language
   */
  createSnippet(options: RequestOptions, language: string, variant: string): Promise<string>;

  requestCreatePlayground(name: string, model: ModelInfo): Promise<string>;

  /**
   * Delete a conversation
   * @param conversationId the conversation identifier that will be deleted
   */
  requestDeleteConversation(conversationId: string): Promise<void>;

  /**
   * Delete a local path
   * @param path path to delete
   */
  requestDeleteLocalRepository(path: string): Promise<void>;

  /**
   * Request the cancellation of a token
   * @param tokenId the id of the CancellationToken to cancel
   */
  requestCancelToken(tokenId: number): Promise<void>;

  /**
   * Import local models selected by user
   * @param models list of local models to import
   */
  importModels(models: LocalModelImportInfo[]): Promise<void>;

  /**
   * Validate a LocalModelImportInfo
   * throw an error if invalid
   */
  validateLocalModel(model: LocalModelImportInfo): Promise<void>;

  /**
   * Copy the provided content to the user clipboard
   * @param content
   */
  copyToClipboard(content: string): Promise<void>;

  /**
   * Check if the running podman machine is running and has enough resources to execute task
   * @param options
   */
  checkContainerConnectionStatusAndResources(
    options: CheckContainerConnectionResourcesOptions,
  ): Promise<ContainerConnectionInfo>;

  /**
   * This method is used by the frontend on reveal to get any potential navigation
   * route it should use. This method has a side effect of removing the pending route after calling.
   */
  readRoute(): Promise<string | undefined>;
}
