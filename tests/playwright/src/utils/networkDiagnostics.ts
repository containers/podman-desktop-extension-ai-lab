/**********************************************************************
 * Copyright (C) 2026 Red Hat, Inc.
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

import { lookup } from 'node:dns/promises';

const PROBE_BYTES = 100 * 1024 * 1024;
const PROBE_TIMEOUT_MS = 60_000;
const FULL_STREAM_TIMEOUT_MS = 240_000;
// Headers that identify the CDN / edge serving the request.
const EDGE_HEADERS = ['server', 'via', 'x-cache', 'x-amz-cf-pop', 'x-amz-cf-id', 'cf-ray', 'x-served-by', 'age'];

function log(message: string): void {
  console.log(`[download-diag] ${message}`);
}

function edgeHeaders(resp: Response): string {
  return EDGE_HEADERS.filter(h => resp.headers.has(h))
    .map(h => `${h}=${resp.headers.get(h)}`)
    .join(' ');
}

async function logDns(host: string): Promise<void> {
  try {
    const addresses = await lookup(host, { all: true });
    log(`dns ${host} -> ${addresses.map(a => a.address).join(', ')}`);
  } catch (err) {
    log(`dns ${host} failed: ${String(err)}`);
  }
}

/** Reads PROBE_BYTES from `offset` into memory, logs throughput, returns the file size (from Content-Range). */
async function probeRange(target: URL, offset: number): Promise<number | undefined> {
  const start = performance.now();
  try {
    const resp = await fetch(target, {
      headers: { Range: `bytes=${offset}-${offset + PROBE_BYTES - 1}` },
      signal: AbortSignal.timeout(PROBE_TIMEOUT_MS),
    });
    const ttfbMs = Math.round(performance.now() - start);
    log(`cdn ${target.host} offset=${offset} status=${resp.status} ttfb=${ttfbMs}ms ${edgeHeaders(resp)}`);
    let received = 0;
    try {
      for await (const chunk of resp.body ?? []) {
        received += (chunk as Uint8Array).length;
      }
    } catch (err) {
      log(`probe stream ended early: ${String(err)}`);
    }
    const seconds = (performance.now() - start) / 1000;
    const mb = received / 1024 / 1024;
    log(
      `throughput offset=${offset} ${mb.toFixed(1)} MB in ${seconds.toFixed(1)}s = ${(mb / seconds).toFixed(2)} MB/s`,
    );
    const total = /\/(\d+)$/.exec(resp.headers.get('content-range') ?? '')?.[1];
    return total ? Number(total) : undefined;
  } catch (err) {
    log(`probe offset=${offset} failed: ${String(err)}`);
    return undefined;
  }
}

/**
 * Streams the whole file over ONE connection into memory (no disk), logging every 250 MB and the longest
 * gap between chunks. Stalling here like the real download does = network/CDN; clean here = client disk.
 */
async function probeFullStream(target: URL): Promise<void> {
  const start = performance.now();
  let received = 0;
  let nextMark = 250 * 1024 * 1024;
  let lastChunk = start;
  let maxGapMs = 0;
  let maxGapAt = 0;
  try {
    const resp = await fetch(target, { signal: AbortSignal.timeout(FULL_STREAM_TIMEOUT_MS) });
    for await (const chunk of resp.body ?? []) {
      const now = performance.now();
      if (now - lastChunk > maxGapMs) {
        maxGapMs = now - lastChunk;
        maxGapAt = received;
      }
      lastChunk = now;
      received += (chunk as Uint8Array).length;
      if (received >= nextMark) {
        log(`full-stream ${(received / 1024 / 1024).toFixed(0)} MB at ${((now - start) / 1000).toFixed(1)}s`);
        nextMark += 250 * 1024 * 1024;
      }
    }
    log(`full-stream completed`);
  } catch (err) {
    log(`full-stream ended early: ${String(err)}`);
  } finally {
    const seconds = (performance.now() - start) / 1000;
    const mb = received / 1024 / 1024;
    log(
      `full-stream ${mb.toFixed(1)} MB in ${seconds.toFixed(1)}s = ${(mb / seconds).toFixed(2)} MB/s, longest gap ${(maxGapMs / 1000).toFixed(1)}s at ${(maxGapAt / 1024 / 1024).toFixed(0)} MB`,
    );
  }
}

/**
 * Logs where a model URL is actually served from (redirect target, DNS, CDN edge headers)
 * single-connection throughput of 100 MB at the start, middle and end of the file,
 * and a full single-connection stream of the file into memory.
 * Never throws: diagnostics must not fail the test.
 */
export async function probeModelDownload(url: string): Promise<void> {
  try {
    const origin = new URL(url);
    await logDns(origin.host);

    const head = await fetch(url, { redirect: 'manual', signal: AbortSignal.timeout(PROBE_TIMEOUT_MS) });
    const location = head.headers.get('location');
    log(`origin ${origin.host} status=${head.status} ${edgeHeaders(head)}`);
    const target = location ? new URL(location, url) : origin;
    if (location) {
      await logDns(target.host);
    }

    // Probe the start, middle and end of the file straight into memory (no disk writes):
    // a slow middle/end means the CDN is the bottleneck, fast everywhere points at the client side.
    const total = await probeRange(target, 0);
    if (total) {
      await probeRange(target, Math.floor(total / 2));
      await probeRange(target, Math.max(0, total - PROBE_BYTES));
    }
    await probeFullStream(target);
  } catch (err) {
    log(`probe failed: ${String(err)}`);
  }
}
