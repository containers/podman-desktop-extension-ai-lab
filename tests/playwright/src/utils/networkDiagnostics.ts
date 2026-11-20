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

/**
 * Logs where a model URL is actually served from (redirect target, DNS, CDN edge headers)
 * and the raw throughput of a single connection over the first 100 MB.
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

    const start = performance.now();
    const resp = await fetch(target, {
      headers: { Range: `bytes=0-${PROBE_BYTES - 1}` },
      signal: AbortSignal.timeout(PROBE_TIMEOUT_MS),
    });
    const ttfbMs = Math.round(performance.now() - start);
    log(`cdn ${target.host} status=${resp.status} ttfb=${ttfbMs}ms ${edgeHeaders(resp)}`);

    let received = 0;
    try {
      for await (const chunk of resp.body ?? []) {
        received += (chunk as Uint8Array).length;
      }
    } catch (err) {
      log(`probe stream ended early: ${String(err)}`);
    }
    const seconds = (performance.now() - start) / 1000;
    log(
      `throughput ${(received / 1024 / 1024).toFixed(1)} MB in ${seconds.toFixed(1)}s = ${(received / 1024 / 1024 / seconds).toFixed(2)} MB/s`,
    );
  } catch (err) {
    log(`probe failed: ${String(err)}`);
  }
}
