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

import { streamText } from 'ai';
import type { LanguageModel, CoreMessage, StepResult, StreamTextResult, TextStreamPart, ToolSet } from 'ai';
import type { ModelOptions } from '@shared/models/IModelOptions';
import type {
  ChatMessage,
  Choice,
  ErrorMessage,
  Message,
  ModelUsage,
  PendingChat,
} from '@shared/models/IPlaygroundMessage';
import { isChatMessage } from '@shared/models/IPlaygroundMessage';
import type { ConversationRegistry } from '../../registries/ConversationRegistry';

export function toCoreMessage(...messages: Message[]): CoreMessage[] {
  return messages
    .filter(m => isChatMessage(m))
    .map(
      (message: ChatMessage) =>
        ({
          role: message.role,
          content: message.content ?? '',
        }) as CoreMessage,
    );
}

export class AiStreamProcessor<TOOLS extends ToolSet> {
  private currentMessageId: string | undefined;
  public readonly abortController: AbortController;

  constructor(
    private conversationId: string,
    private conversationRegistry: ConversationRegistry,
  ) {
    this.abortController = new AbortController();
    this.abortController.signal.addEventListener('abort', this.onAbort);
  }

  private onStepFinish = (stepResult: StepResult<TOOLS>): void => {
    if (this.currentMessageId !== undefined) {
      this.conversationRegistry.setUsage(this.conversationId, this.currentMessageId, {
        completion_tokens: stepResult.usage.completionTokens,
        prompt_tokens: stepResult.usage.promptTokens,
      } as ModelUsage);
      // TODO, this doesn't seem very wise (using choices as partial state holder)
      // Refactor to use this.conversationRegistry.update instead
      this.conversationRegistry.completeMessage(this.conversationId, this.currentMessageId);
    }
    this.currentMessageId = undefined;
  };

  private onChunk = ({
    chunk,
  }: {
    chunk: Extract<
      TextStreamPart<TOOLS>,
      {
        type:
          | 'text-delta'
          | 'reasoning'
          | 'source'
          | 'tool-call'
          | 'tool-call-streaming-start'
          | 'tool-call-delta'
          | 'tool-result';
      }
    >;
  }): void => {
    if (chunk.type !== 'text-delta') {
      return;
    }
    if (this.currentMessageId === undefined) {
      this.currentMessageId = this.conversationRegistry.getUniqueId();
      this.conversationRegistry.submit(this.conversationId, {
        id: this.currentMessageId,
        role: 'assistant',
        timestamp: Date.now(),
        choices: [],
        completed: undefined,
      } as PendingChat);
    }
    // TODO, this doesn't seem very wise (using choices as partial state holder)
    // Refactor to use this.conversationRegistry.update instead
    this.conversationRegistry.appendChoice(this.conversationId, this.currentMessageId, {
      content: chunk.textDelta,
    } as Choice);
  };

  private onError = (error: unknown): void => {
    if (error instanceof Object && 'error' in error) {
      error = error.error;
    }
    if (error instanceof Error) {
      error = error.message;
    }
    let errorMessage = String(error);
    if (errorMessage.endsWith('Please reduce the length of the messages or completion.')) {
      errorMessage += ' Note: You should start a new playground.';
    }
    console.error('Something went wrong while creating model response', errorMessage);
    this.conversationRegistry.submit(this.conversationId, {
      id: this.conversationRegistry.getUniqueId(),
      timestamp: Date.now(),
      error: errorMessage,
    } as ErrorMessage);
  };

  private onAbort = (): void => {
    // Ensure the last message is marked as complete to allow the user to resume the conversation
    if (this.currentMessageId !== undefined) {
      // TODO, this doesn't seem very wise (using choices as partial state holder)
      // Refactor to use this.conversationRegistry.update instead
      this.conversationRegistry.completeMessage(this.conversationId, this.currentMessageId);
    }
  };

  stream = (model: LanguageModel, options?: ModelOptions): StreamTextResult<TOOLS, never> => {
    return streamText({
      model,
      temperature: options?.temperature,
      maxTokens: (options?.max_tokens ?? -1) < 1 ? undefined : options?.max_tokens,
      topP: options?.top_p,
      abortSignal: this.abortController.signal,
      messages: toCoreMessage(...this.conversationRegistry.get(this.conversationId).messages),
      onStepFinish: this.onStepFinish,
      onError: this.onError,
      onChunk: this.onChunk,
    });
  };
}
