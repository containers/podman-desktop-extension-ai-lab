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

import { describe, test, expect, beforeEach, vi } from 'vitest';
import * as ai from 'ai';
import { AiStreamProcessor, toCoreMessage } from './aiSdk';
import type {
  AssistantChat,
  ChatMessage,
  ErrorMessage,
  Message,
  PendingChat,
  UserChat,
} from '@shared/models/IPlaygroundMessage';
import type { LanguageModelV1, LanguageModelV1CallWarning, LanguageModelV1StreamPart } from '@ai-sdk/provider';
// @ts-expect-error this is a test module
import { convertArrayToReadableStream } from '@ai-sdk/provider-utils/test';
import { ConversationRegistry } from '../../registries/ConversationRegistry';
import type { RpcExtension } from '@shared/messages/MessageProxy';
import type { ModelOptions } from '@shared/models/IModelOptions';

vi.mock('ai', async original => {
  const mod = (await original()) as object;
  return { ...mod };
});

describe('aiSdk', () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });
  describe('toCoreMessage', () => {
    test('with no fields', () => {
      const result = toCoreMessage({} as Message);
      expect(result).toEqual([]);
    });
    test('with no role', () => {
      const result = toCoreMessage({ content: 'alex' } as ChatMessage);
      expect(result).toEqual([]);
    });
    test('with no content', () => {
      const result = toCoreMessage({ role: 'user' } as ChatMessage);
      expect(result).toEqual([{ role: 'user', content: '' }]);
    });
    test('with all fields', () => {
      const result = toCoreMessage({ role: 'user', content: 'alex' } as ChatMessage);
      expect(result).toEqual([{ role: 'user', content: 'alex' }]);
    });
    test('with multiple messages', () => {
      const result = toCoreMessage(
        { role: 'user', content: 'alex' } as ChatMessage,
        { role: 'assistant', content: 'bob' } as ChatMessage,
      );
      expect(result).toEqual([
        { role: 'user', content: 'alex' },
        { role: 'assistant', content: 'bob' },
      ]);
    });
  });
  describe('AiStreamProcessor', () => {
    let conversationRegistry: ConversationRegistry;
    let conversationId: string;
    beforeEach(() => {
      const rpcExtension = {
        fire: vi.fn().mockResolvedValue(true),
      } as unknown as RpcExtension;
      conversationRegistry = new ConversationRegistry(rpcExtension);
      conversationId = conversationRegistry.createConversation('test-conversation', 'test-model');
      conversationRegistry.submit(conversationId, {
        content: 'Aitana, please proceed with the test',
        role: 'user',
        id: conversationRegistry.getUniqueId(),
        timestamp: Date.now(),
      } as UserChat);
    });
    test('sends model options', async () => {
      const streamTextSpy = vi.spyOn(ai, 'streamText');
      const streamProcessor = new AiStreamProcessor(conversationId, conversationRegistry);
      const streamResult = streamProcessor.stream(createTestModel(), {
        temperature: 42,
        top_p: 13,
        max_tokens: 37,
        stream_options: { include_usage: true },
      } as ModelOptions);
      await streamResult.consumeStream();
      expect(streamTextSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          model: expect.anything(),
          temperature: 42,
          maxTokens: 37,
          topP: 13,
          abortSignal: expect.any(AbortSignal),
          messages: expect.any(Array),
          onStepFinish: expect.any(Function),
          onError: expect.any(Function),
          onChunk: expect.any(Function),
        }),
      );
    });
    test('abort, completes the last assistant message', async () => {
      const incompleteMessageId = 'incomplete-message-id';
      conversationRegistry.submit(conversationId, {
        id: incompleteMessageId,
        role: 'assistant',
        timestamp: Date.now(),
        choices: [],
        completed: undefined,
      } as PendingChat);
      const streamProcessor = new AiStreamProcessor(conversationId, conversationRegistry);
      streamProcessor['currentMessageId'] = incompleteMessageId;
      streamProcessor.abortController.abort('cancel');
      expect(conversationRegistry.get(conversationId).messages).toHaveLength(2);
      expect((conversationRegistry.get(conversationId).messages[1] as AssistantChat).completed).not.toBeUndefined();
    });
    describe('with stream error', () => {
      beforeEach(async () => {
        // eslint-disable-next-line sonarjs/no-nested-functions
        const doStream: LanguageModelV1['doStream'] = async () => {
          throw new Error('The stream is kaput.');
        };
        const model = new MockLanguageModelV1({ doStream });
        await new AiStreamProcessor(conversationId, conversationRegistry).stream(model).consumeStream();
      });
      test('appends a single message', () => {
        expect(conversationRegistry.get(conversationId).messages).toHaveLength(2);
      });
      test('appended message is error', () => {
        expect((conversationRegistry.get(conversationId).messages[1] as ErrorMessage).error).toEqual(
          'The stream is kaput.',
        );
      });
    });
    describe('with single message stream', () => {
      let model: LanguageModelV1;
      beforeEach(async () => {
        model = createTestModel({
          stream: convertArrayToReadableStream([
            {
              type: 'response-metadata',
              id: 'id-0',
              modelId: 'mock-model-id',
              timestamp: new Date(0),
            },
            { type: 'text-delta', textDelta: 'Greetings' },
            { type: 'text-delta', textDelta: ' professor ' },
            { type: 'text-delta', textDelta: `Falken` },
            { type: 'finish', finishReason: 'stop', usage: { completionTokens: 133, promptTokens: 7 } },
          ]),
        });
        await new AiStreamProcessor(conversationId, conversationRegistry).stream(model).consumeStream();
      });
      test('appends a single message', () => {
        expect(conversationRegistry.get(conversationId).messages).toHaveLength(2);
      });
      test('appended message is from assistant', () => {
        expect((conversationRegistry.get(conversationId).messages[1] as ChatMessage).role).toEqual('assistant');
      });
      test('concatenates message content', () => {
        expect((conversationRegistry.get(conversationId).messages[1] as ChatMessage).content).toEqual(
          'Greetings professor Falken',
        );
      });
      test('setsUsage', async () => {
        await new AiStreamProcessor(conversationId, conversationRegistry).stream(model).consumeStream();
        const message = conversationRegistry.get(conversationId).messages[1] as ChatMessage;
        expect(message?.usage?.completion_tokens).toEqual(133);
        expect(message?.usage?.prompt_tokens).toEqual(7);
      });
    });
  });
});

export class MockLanguageModelV1 implements LanguageModelV1 {
  readonly specificationVersion = 'v1';
  readonly provider: LanguageModelV1['provider'];
  readonly modelId: LanguageModelV1['modelId'];

  supportsUrl: LanguageModelV1['supportsUrl'];
  doGenerate: LanguageModelV1['doGenerate'];
  doStream: LanguageModelV1['doStream'];

  readonly defaultObjectGenerationMode: LanguageModelV1['defaultObjectGenerationMode'];
  readonly supportsStructuredOutputs: LanguageModelV1['supportsStructuredOutputs'];
  constructor({ doStream = notImplemented }: { doStream?: LanguageModelV1['doStream'] }) {
    this.provider = 'mock-model-provider';
    this.modelId = 'mock-model-id';
    this.doGenerate = notImplemented;
    this.doStream = doStream;
  }
}

function notImplemented(): never {
  throw new Error('Not implemented');
}

export function createTestModel({
  stream = convertArrayToReadableStream([]),
  rawCall = { rawPrompt: 'prompt', rawSettings: {} },
  rawResponse = undefined,
  request = undefined,
  warnings,
}: {
  stream?: ReadableStream<LanguageModelV1StreamPart>;
  rawResponse?: { headers: Record<string, string> };
  rawCall?: { rawPrompt: string; rawSettings: Record<string, unknown> };
  request?: { body: string };
  warnings?: LanguageModelV1CallWarning[];
} = {}): LanguageModelV1 {
  return new MockLanguageModelV1({
    doStream: async () => ({ stream, rawCall, rawResponse, request, warnings }),
  });
}
