# Mac comparison for local AI: top 10 candidates

*Prepared 2026-11-09. Prices come from search snippets. **None of these listings has been opened or confirmed with the seller**, because this session's network policy blocked page fetches. Treat each as a lead to verify, not a live offer.*

Legend: **[M]** measured by a third party (source given) · **[E]** my estimate from memory bandwidth and model size · **[R]** user-reported anecdote.

## 1. Chip reference

| Chip | CPU / GPU cores | Max unified memory | Memory bandwidth | 7B Q4_0 decode (llama.cpp #4167) |
|---|---|---|---|---|
| M1 Max | 10 / 24-32 | 64 GB | 400 GB/s | 61 t/s (32-core GPU) **[M]** |
| M2 Max | 12 / 30-38 | 96 GB | 400 GB/s | 66 t/s (38-core GPU) **[M]** |
| M3 Max | 14-16 / 30-40 | 128 GB | 300-400 GB/s | 66 t/s (40-core GPU) **[M]** |
| M4 Max | 14-16 / 32-40 | 128 GB | 410-546 GB/s | 70 / 83 t/s (32 / 40-core GPU) **[M]** |
| M1 Ultra | 20 / 48-64 | 128 GB | 800 GB/s | about 1.3-1.5× Max **[E]** |
| M2 Ultra | 24 / 60-76 | 192 GB | 800 GB/s | about 1.4-1.5× Max **[E]** |
| M3 Ultra | 28-32 / 60-80 | 96 GB (512 GB before the Mar 2026 cut) | 819 GB/s | about 1.5× Max **[E]** |

Sources: Max-chip figures come from the llama.cpp Apple Silicon thread (#4167), as summarised by markaicode.com. I could not read the Ultra rows through search. A Medium analysis citing the thread puts Max→Ultra scaling at only about 1.5× for Q4_0 decode.

**How these chips behave on LLMs**
- **Decode speed** (tokens per second while generating) is limited by memory bandwidth, so Ultras are about 1.5× a Max, not 2×.
- **Prefill** (reading the prompt) is limited by GPU compute. Ultras have twice the GPU cores of a Max, so they read prompts about twice as fast. Coding agents send very large prompts (repo context, tool output), so prefill often matters more than decode. This is the strongest reason to prefer an Ultra for four agents.
- **Capacity** decides which models fit at all. Four agents each hold their own KV cache (the model's working memory for the conversation). For a 32B dense model at fp16, the KV cache is about 0.26 MB per token **[E]**:

  | Item | Memory |
  |---|---|
  | One agent at 32k context | ≈ 8.5 GB |
  | Four agents at 32k context | ≈ 34 GB |
  | Weights, 27-32B at Q4 | ≈ 17-20 GB |
  | macOS, tools, editors | ≈ 8-10 GB |
  | **Total** | **≈ 60-64 GB** |

  That fills a 64 GB machine completely, and macOS lets the GPU use only about 75% of RAM by default (it can be raised with `iogpu.wired_limit_mb`). **128 GB is the comfortable size for four agents.** 192 GB adds room for a 70B dense model, or a 100-120B MoE model, with four long contexts.
- **MoE models change the picture.** Mixture-of-experts models activate only part of the network per token, so they decode much faster than dense models of the same total size. gpt-oss-120b (about 63 GB at MXFP4) or GLM-4.5-Air-class models (about 60 GB at Q4) need 96-128 GB but decode quickly. A 128 GB machine opens this class of model; 64 GB does not.
- **Newer is not always faster here.** For decode, an M1 Ultra (800 GB/s) beats an M4 Max (546 GB/s). For prefill, the M3 and M4 generations have more compute per core. The M5 generation adds GPU matrix accelerators that speed up prefill, but M5 machines with 64 GB+ are not yet in the used market at sensible prices.

## 2. Candidates

Prices are converted to EUR (1 CHF = 1.0723 EUR, 1 USD = 0.8924 EUR, rates from Oct 2026; re-check before making offers).

| # | Machine | Lead source (status) | Asking price | EUR | 2026 market reference |
|---|---|---|---|---|---|
| 1 | **MacBook Pro 16" M1 Max 64 GB**, SSD n/s, 137 cycles | eBay.de · ict-remarketing (unverified snippet) | €1,240 | 1,240 | Refurb €1,400-1,999 |
| 2 | **MacBook Pro 16" M2 Max 96 GB / 1 TB** (38-core GPU) | Creative IT, Ireland (unverified snippet) | €2,519 | 2,519 | Back Market UK £2,999 (2 TB) |
| 3 | **Mac Studio M1 Ultra 128 GB / 1-2 TB** (48-core GPU) | Revendo, CH (product pages indexed, price unknown) | ? | est. 3,000-3,800 | eBay sold $3,850-4,600 (Sep-Oct 2026) |
| 4 | **Mac Studio M2 Ultra 128 GB / 4 TB** | eBay Refurbished IT via refurb.me (unverified, late Oct) | €4,719 | 4,719 | eBay sold $4,199-5,399 |
| 5 | **Mac Studio M2 Ultra 192 GB** | Revendo off-market request (last unit CHF 3,158, sold out) | ? | target 4,300-5,200 | eBay sold $5,925-7,300 |
| 6 | **Mac Studio M2 Ultra 64 GB / 1 TB** | refurb.me IT €2,768 (stale?) / DE €3,599 (unverified) | €2,768-3,599 | 2,768-3,599 | eBay.de auction €3,100 (2 TB) |
| 7 | **MacBook Pro 16" M1 Max 64 GB / 1 TB** (32-core GPU), US keyboard | Revendo, CH (unverified) | CHF 1,835 | 1,968 | - |
| 8 | **MacBook Pro 16" M1 Max 64 GB / 4 TB** "wie neu" | eBay.de private (undated) | €2,350 | 2,350 | - |
| 9 | **Mac Studio M1 Max 64 GB / 1 TB**, grade A | JES on Digitec, CH (price unknown) | ? | est. 1,500-1,900 | - |
| 10 | **Mac Studio M3 Ultra 96 GB** | refurbed.at €6,199 / Apple Certified Refurbished (unverified) | €6,199 | 6,199 | New in US: $5,299 since the Jun 2026 price rise |

## 3. AI capability per candidate

Speeds below are single-stream decode at short context, Q4_K_M quantization, using llama.cpp or MLX. All are **[E]** unless marked otherwise.

| # | 27B at 4-6 bit | 70B dense at Q4 | 100-120B MoE | Four 27B agents, aggregate | Headroom for long contexts |
|---|---|---|---|---|---|
| 1 / 7 / 8 | 12-15 t/s | 5-7 t/s, short context only | No | about 20-30 t/s total, about 5-8 t/s per agent; prefill is the bottleneck | Tight. Use q8 KV cache or 16k contexts |
| 2 | 13-16 t/s | 6-8 t/s | gpt-oss-120b just fits (little headroom) | about 22-32 t/s total | Good for four 27B agents with 32k contexts |
| 3 | 20-25 t/s | 10-13 t/s | Yes (60-65 GB MoE fits easily) | about 35-50 t/s total; prefill about 2× #1 | Comfortable: four agents at 32-64k |
| 4 | 22-28 t/s | 12-15 t/s (one owner reports about 22 t/s **[R]**, quantization unstated) | Yes | about 40-55 t/s total | Comfortable |
| 5 | 22-28 t/s | 12-15 t/s, or Q6/Q8 70B at about 5-9 t/s | Yes, plus about 110 GB Q3 235B-class MoE | about 40-55 t/s total | Best: long contexts plus large models |
| 6 | 22-28 t/s | Only about 40 GB of weights fit next to the KV cache; tight | No | High speed but memory-bound; four 27B agents only with q8 KV | Tight (the same 64 GB limit as #1) |
| 9 | 12-15 t/s | Tight | No | Same as #1 | Tight |
| 10 | 24-30 t/s | 12-16 t/s | Yes (96 GB) | about 45-60 t/s total; better prefill | Good, though 96 GB is less than 128 GB |

The four-agent figures assume continuous batching (llama.cpp `--parallel 4` or MLX batched generation). Aggregate throughput is typically 1.5-2.5× single-stream, while each agent runs at 40-60% of its solo speed **[E]**. Benchmark on the machine before paying: `llama-bench` plus a four-client test.

## 4. Value assessment

| # | € per GB | € per GB/s | Assessment |
|---|---|---|---|
| 1 | 19 | 3.1 | **Exceptional if real.** About 20-35% below refurb. The best cheap 64 GB machine. Verify first: GPU cores, SSD, Activation Lock, battery. |
| 2 | 26 | 6.3 | **Best portable.** 96 GB unlocks MoE-120B and four comfortable 27B agents. A fair price for 2026. Has 12-month warranty and EU purchase (no import VAT to Italy). |
| 3 | 23-30 | 3.8-4.8 | **Best value for 128 GB, if bought at €3,000-3,300.** Revendo is the most likely holder. |
| 4 | 37 | 5.9 | Market price, not a deal. Open with €4,000-4,200. |
| 5 | 22-27 at target | 5.4-6.5 | **The top prize.** Only realistic off-market (Revendo or a studio). At ≤€5,000 it beats every new option for 4× agents plus 70B. |
| 6 | 43-56 | 3.5-4.5 | Fast but memory-limited. Not worth an Ultra premium over a 96-128 GB machine. |
| 7 | 31 (CH) | 4.9 | Worse than #1 on price. US keyboard. Delivered to Italy it costs about €2,300 after Italian import VAT. |
| 8 | 37 | 5.9 | Paying for 4 TB you may not need. Overpriced. |
| 9 | ≈25-30 | ≈4-5 | Desktop alternative to #1, with no battery risk. |
| 10 | 65 | 7.6 | Best warranty and newest, but poor €/GB. Only if bought as Apple Certified Refurbished with a warranty. |

**Future flexibility:** 128-192 GB machines keep their usefulness (and resale value) as open models grow and MoE spreads. The 2026 DRAM shortage has raised prices for every high-memory Mac. M1-family machines will lose macOS support first. M2 Ultra is the longest-lived used option short of M3 Ultra.

**Risks common to all:**
- Ex-corporate units may still be enrolled in Apple Business Manager or MDM. Get written confirmation of release, or a serial check, before paying.
- Activation Lock must be off.
- MacBooks: check battery cycles and health (#1 reports 137 cycles, which is good).
- Mac Studio: listen for fan noise and check SSD wear (`smartctl`).
- No AppleCare on 2022-23 units; a 12-month dealer warranty is worth about €150-300.
- Private sales: pay on handover, or use a payment method with buyer protection.
- Cross-border purchases: see the delivered-cost rules in `acquisition_report.md`.
