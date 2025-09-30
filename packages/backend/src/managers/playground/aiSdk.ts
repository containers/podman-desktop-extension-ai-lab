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

import { streamText, stepCountIs } from 'ai';
import type {
  LanguageModel,
  ModelMessage,
  StepResult,
  StreamTextResult,
  StreamTextOnFinishCallback,
  TextStreamPart,
  ToolCallPart,
  ToolResultPart,
  ToolSet,
} from 'ai';
import type { ModelOptions } from '@shared/models/IModelOptions';
import {
  type AssistantChat,
  type ErrorMessage,
  isAssistantToolCall,
  type Message,
  type ModelUsage,
  type PendingChat,
  type ToolCall,
} from '@shared/models/IPlaygroundMessage';
import { isChatMessage } from '@shared/models/IPlaygroundMessage';
import type { ConversationRegistry } from '../../registries/ConversationRegistry';

export function toCoreMessage(...messages: Message[]): ModelMessage[] {
  const ret: ModelMessage[] = [];
  for (const message of messages) {
    if (isAssistantToolCall(message)) {
      const toolCall = message.content as ToolCall;
      ret.push({
        role: 'assistant',
        content: [
          {
            type: 'tool-call',
            toolCallId: toolCall.toolCallId,
            toolName: toolCall.toolName,
            input: toolCall.args,
          } as ToolCallPart,
        ] as ToolCallPart[],
      } as ModelMessage);
      if (toolCall.result) {
        ret.push({
          role: 'tool',
          content: [
            {
              type: 'tool-result',
              toolCallId: toolCall.toolCallId,
              toolName: toolCall.toolName,
              output: toolCall.result,
            } as ToolResultPart,
          ] as ToolResultPart[],
        } as ModelMessage);
      }
    } else if (isChatMessage(message)) {
      ret.push({
        role: message.role,
        content: message.content ?? '',
      } as ModelMessage);
    }
  }
  return ret;
}

export class AiStreamProcessor<TOOLS extends ToolSet> {
  private stepStartTime: number | undefined;
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
    this.conversationRegistry.setUsage(this.conversationId, {
      completion_tokens: stepResult.usage.outputTokens,
      prompt_tokens: stepResult.usage.inputTokens,
    } as ModelUsage);
    if (this.currentMessageId !== undefined) {
      this.conversationRegistry.completeMessage(this.conversationId, this.currentMessageId);
    }
    if (stepResult.toolCalls?.length > 0) {
      for (const toolCall of stepResult.toolCalls) {
        this.conversationRegistry.submit(this.conversationId, {
          id: this.conversationRegistry.getUniqueId(),
          role: 'assistant',
          timestamp: this.stepStartTime,
          content: {
            type: 'tool-call',
            toolCallId: toolCall.toolCallId,
            toolName: toolCall.toolName,
            args: toolCall.input,
          } as ToolCall,
        } as AssistantChat);
      }
    }
    if (stepResult.toolResults?.length > 0) {
      for (const toolResult of stepResult.toolResults) {
        this.conversationRegistry.toolResult(
          this.conversationId,
          toolResult.toolCallId,
          toolResult.output as string | object,
        );
      }
    }
    this.currentMessageId = undefined;
    this.stepStartTime = Date.now();
  };

  private onChunk = ({ chunk }: { chunk: TextStreamPart<TOOLS> }): void => {
    if (chunk.type !== 'text-delta') {
      return;
    }
    if (this.currentMessageId === undefined) {
      this.currentMessageId = this.conversationRegistry.getUniqueId();
      this.conversationRegistry.submit(this.conversationId, {
        id: this.currentMessageId,
        role: 'assistant',
        timestamp: this.stepStartTime,
        choices: [],
        completed: undefined,
      } as PendingChat);
    }
    this.conversationRegistry.textDelta(this.conversationId, this.currentMessageId, chunk.text);
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
      this.conversationRegistry.completeMessage(this.conversationId, this.currentMessageId);
    }
  };

  private onFinish: StreamTextOnFinishCallback<TOOLS> = stepResult => {
    this.conversationRegistry.setUsage(this.conversationId, {
      completion_tokens: stepResult.usage.outputTokens,
      prompt_tokens: stepResult.usage.inputTokens,
    } as ModelUsage);
  };

  stream = (model: LanguageModel, tools?: TOOLS, options?: ModelOptions): StreamTextResult<TOOLS, never> => {
    this.stepStartTime = Date.now();
    return streamText({
      model,
      tools,
      stopWhen: stepCountIs(10),
      temperature: options?.temperature,
      maxOutputTokens: (options?.max_tokens ?? -1) < 1 ? undefined : options?.max_tokens,
      topP: options?.top_p,
      abortSignal: this.abortController.signal,
      messages: toCoreMessage(...this.conversationRegistry.get(this.conversationId).messages),
      onStepFinish: this.onStepFinish,
      onError: this.onError,
      onChunk: this.onChunk,
      onFinish: this.onFinish,
    });
  };
}
