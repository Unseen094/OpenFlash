#!/usr/bin/env python3
"""
tps_bench.py — Measure tokens-per-second (TPS) of an OpenAI-compatible API.
Zero dependencies (Python standard library only).

How it works:
  1. Sends a streaming chat completion request.
  2. Measures time-to-first-token (TTFT) and generation time.
  3. Uses server-reported usage.completion_tokens when available,
     otherwise estimates ~4 chars/token.
  4. Prints generation TPS (after first token) and end-to-end TPS.

Example:
    python tps_bench.py \
        --base-url http://localhost:8000/v1 \
        --model my-model \
        --api-key sk-xxx \
        --runs 3
"""

import argparse
import json
import os
import sys
import time
import urllib.error
import urllib.request


def run_once(base_url, api_key, model, prompt, max_tokens, temperature,
             timeout, include_usage=True):
    """Perform one streaming request and collect timing/token stats."""
    url = base_url.rstrip("/") + "/chat/completions"
    payload = {
        "model": model,
        "messages": [{"role": "user", "content": prompt}],
        "max_tokens": max_tokens,
        "temperature": temperature,
        "stream": True,
    }
    if include_usage:
        payload["stream_options"] = {"include_usage": True}

    req = urllib.request.Request(
        url,
        data=json.dumps(payload).encode("utf-8"),
        headers={
            "Content-Type": "application/json",
            "Authorization": "Bearer " + api_key,
        },
        method="POST",
    )

    start = time.perf_counter()
    first_token_at = None
    text_chars = 0
    usage = None
    finish_reason = None

    with urllib.request.urlopen(req, timeout=timeout) as resp:
        while True:
            raw = resp.readline()
            if not raw:
                break
            line = raw.strip()
            if not line.startswith(b"data:"):
                continue
            data = line[len(b"data:"):].strip()
            if data == b"[DONE]":
                break
            try:
                event = json.loads(data)
            except json.JSONDecodeError:
                continue

            if event.get("usage"):
                usage = event["usage"]

            choices = event.get("choices") or []
            if not choices:
                continue
            delta = choices[0].get("delta") or {}
            # 'reasoning_content' covers reasoning models (e.g. DeepSeek R1)
            piece = delta.get("content") or delta.get("reasoning_content")
            if piece:
                if first_token_at is None:
                    first_token_at = time.perf_counter()
                text_chars += len(piece)
            if choices[0].get("finish_reason"):
                finish_reason = choices[0]["finish_reason"]

    end = time.perf_counter()

    if first_token_at is None:
        raise RuntimeError("No content streamed back from the server.")

    total_time = end - start
    ttft = first_token_at - start
    gen_time = end - first_token_at

    if usage and usage.get("completion_tokens"):
        tokens = usage["completion_tokens"]
        source = "server-reported"
    else:
        tokens = max(1, text_chars // 4)
        source = "estimated(chars/4)"

    return {
        "tokens": tokens,
        "token_source": source,
        "prompt_tokens": (usage or {}).get("prompt_tokens"),
        "total_time": total_time,
        "ttft": ttft,
        "gen_time": gen_time,
        "tps_gen": tokens / gen_time if gen_time > 0 else float("nan"),
        "tps_e2e": tokens / total_time if total_time > 0 else float("nan"),
        "finish_reason": finish_reason,
    }


def benchmark(args):
    results = []
    for i in range(1, args.runs + 1):
        try:
            r = run_once(args.base_url, args.api_key, args.model, args.prompt,
                         args.max_tokens, args.temperature, args.timeout)
        except urllib.error.HTTPError as e:
            body = e.read().decode("utf-8", "replace")
            # Some servers reject stream_options — retry without it.
            if e.code == 400 and "stream_options" in body:
                r = run_once(args.base_url, args.api_key, args.model,
                             args.prompt, args.max_tokens, args.temperature,
                             args.timeout, include_usage=False)
            else:
                print(f"\nHTTP {e.code} from server:\n{body}", file=sys.stderr)
                sys.exit(1)
        except urllib.error.URLError as e:
            print(f"\nConnection error: {e.reason}", file=sys.stderr)
            sys.exit(1)
        except KeyboardInterrupt:
            print("\nInterrupted.")
            sys.exit(130)

        results.append(r)
        print(f"\nRun {i}/{args.runs}")
        print(f"  TTFT:            {r['ttft']:.3f} s")
        print(f"  Total time:      {r['total_time']:.3f} s")
        print(f"  Output tokens:   {r['tokens']} ({r['token_source']})")
        if r["prompt_tokens"] is not None:
            print(f"  Prompt tokens:   {r['prompt_tokens']}")
        print(f"  TPS (gen):       {r['tps_gen']:.2f} tok/s")
        print(f"  TPS (total):     {r['tps_e2e']:.2f} tok/s")
        print(f"  Finish reason:   {r['finish_reason']}")

    if len(results) > 1:
        avg = lambda k: sum(r[k] for r in results) / len(results)
        print(f"\n=== Average over {len(results)} runs ===")
        print(f"  TTFT:            {avg('ttft'):.3f} s")
        print(f"  TPS (gen):       {avg('tps_gen'):.2f} tok/s")
        print(f"  TPS (total):     {avg('tps_e2e'):.2f} tok/s")


def main():
    p = argparse.ArgumentParser(
        description="Measure TPS of an OpenAI-compatible API (stdlib only).")
    p.add_argument("--base-url",
                   default=os.environ.get("OPENAI_BASE_URL",
                                          "http://localhost:8000/v1"),
                   help="e.g. http://localhost:8000/v1 (default: %(default)s)")
    p.add_argument("--api-key",
                   default=os.environ.get("OPENAI_API_KEY", "sk-none"),
                   help="defaults to $OPENAI_API_KEY")
    p.add_argument("--model",
                   default=os.environ.get("OPENAI_MODEL"),
                   help="model name (required unless $OPENAI_MODEL is set)")
    p.add_argument("--prompt",
                   default="Write a long, detailed essay about the history "
                           "of computing. Do not stop early.",
                   help="prompt used for the benchmark")
    p.add_argument("--max-tokens", type=int, default=512,
                   help="max tokens to generate (default: %(default)s)")
    p.add_argument("--temperature", type=float, default=0.0)
    p.add_argument("--runs", type=int, default=1,
                   help="number of runs to average (default: %(default)s)")
    p.add_argument("--timeout", type=float, default=300.0,
                   help="request timeout in seconds (default: %(default)s)")
    args = p.parse_args()

    if not args.model:
        p.error("--model is required (or set $OPENAI_MODEL)")

    print(f"Endpoint:   {args.base_url.rstrip('/')}/chat/completions")
    print(f"Model:      {args.model}")
    print(f"Max tokens: {args.max_tokens}")
    benchmark(args)


if __name__ == "__main__":
    main()