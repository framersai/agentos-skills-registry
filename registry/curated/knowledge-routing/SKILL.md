---
name: knowledge-routing
version: '1.0.0'
description: QueryRouter for intelligent retrieval — classify queries into T0-T3 tiers, configure confidence thresholds, and route to the optimal retrieval strategy.
author: Wunderland
namespace: wunderland
category: productivity
tags: [query-router, classification, retrieval, RAG, vector-search, knowledge, routing]
requires_secrets: []
requires_tools: []
metadata:
  agentos:
    emoji: "\U0001F6E4"
---

# Knowledge Routing

You have a QueryRouter that classifies every incoming query and routes it to the optimal retrieval strategy. Understanding how the router works lets you give better answers, set appropriate expectations about response latency, and help users configure the system for their use case.

## The Four Tiers

### T0 — Conversational (No Retrieval)

The query can be answered from the LLM's parametric knowledge or the current conversation context alone. No external retrieval is needed.

- **Examples**: "What is a REST API?", "Summarize what we discussed", "Hello", "Thanks"
- **Latency**: Instant (no retrieval overhead)
- **Confidence threshold**: >= 0.85 (the classifier must be very confident no retrieval is needed)

### T1 — Vector Search (Semantic Retrieval)

The query needs information from the memory store, and a single semantic similarity search will likely surface the answer.

- **Examples**: "What did the user say about their deployment setup?", "Find my notes on Kubernetes"
- **Latency**: Low (single embedding + ANN lookup, typically < 200ms)
- **Confidence threshold**: >= 0.6
- **Retrieval**: Embeds the query, searches the vector index, returns top-k results ranked by cosine similarity

### T2 — Hybrid + Graph (Multi-Signal Retrieval)

The query requires combining multiple retrieval signals — vector similarity, keyword matching, and graph traversal — to find a complete answer.

- **Examples**: "How does the auth system connect to the billing module?", "What changed in the codebase since last week related to security?"
- **Latency**: Medium (parallel vector + keyword search, then graph expansion, typically < 1s)
- **Confidence threshold**: >= 0.4
- **Retrieval**: Runs vector search AND keyword/BM25 search in parallel, then expands results via graph edges (DEPENDS_ON, COMPOSED_WITH, SAME_CATEGORY), re-ranks the combined set

### T3 — Deep Research (Multi-Step Retrieval)

The query is complex, open-ended, or requires synthesizing information from many sources across multiple retrieval rounds.

- **Examples**: "Write a comprehensive analysis of our API performance over the last quarter", "Compare all deployment strategies we've discussed and recommend one"
- **Latency**: High (multiple retrieval rounds, sub-query decomposition, typically 2-10s)
- **Confidence threshold**: < 0.4 (fallback when other tiers lack confidence)
- **Retrieval**: Decomposes the query into sub-queries, runs T2-level retrieval for each, synthesizes and cross-references results, may perform follow-up queries based on gaps

## How the Classifier Works

The QueryRouter classifier uses a lightweight model to score each query across all four tiers simultaneously:

1. **Feature extraction** — The query is analyzed for: length, question type (factual/procedural/analytical/conversational), entity density, temporal references, scope markers (single-fact vs. multi-fact vs. synthesis)
2. **Tier scoring** — Each tier receives a confidence score (0-1). The scores across all tiers sum to 1.0.
3. **Threshold comparison** — The highest-scoring tier is selected if it meets its confidence threshold. If not, the next tier is tried.
4. **Fallback** — If no tier meets its threshold (rare), T3 is used as the catch-all.

The classifier is fast (< 10ms) and runs before any retrieval begins, so it adds negligible overhead.

## Configuring Confidence Thresholds

Each tier's confidence threshold controls how eagerly the router selects that tier:

- **Higher T0 threshold** (e.g., 0.95) — More queries go to retrieval. Safer but slower on average. Good for knowledge-intensive domains.
- **Lower T0 threshold** (e.g., 0.70) — More queries answered without retrieval. Faster but may miss relevant stored knowledge. Good for conversational agents.
- **Higher T1 threshold** (e.g., 0.80) — Pushes borderline queries to T2 hybrid search. Better recall at the cost of latency.
- **Lower T2 threshold** (e.g., 0.30) — Fewer queries escalate to expensive T3 deep research.

Default thresholds work well for general use. Adjust them when you know the domain:
- **Dense knowledge base** (technical docs, legal, medical) → Lower T0, higher T1/T2 thresholds
- **Conversational assistant** (customer support, casual chat) → Higher T0, lower T1/T2 thresholds
- **Research agent** (analysis, synthesis tasks) → Lower thresholds across the board, favoring T2/T3

## Corpus Paths

The router searches against configured corpus paths — directories or collections that contain indexed content:

- **Default corpus** — The agent's primary memory store (all scopes the agent has access to)
- **Project corpus** — A specific project directory or workspace that has been ingested
- **Domain corpus** — A curated knowledge base for a specific domain (e.g., company docs, product specs)

You can scope a query to a specific corpus by tagging it, which narrows the search space and improves both speed and relevance.

## Embedding Providers

The vector search component requires an embedding model. The router supports multiple providers:

- **OpenAI** — `text-embedding-3-small` (default), `text-embedding-3-large` for higher recall
- **Local** — ONNX-based models that run entirely on-device (no API calls, zero latency for embedding)
- **Custom** — Any provider implementing the `IEmbeddingProvider` interface

All providers produce normalized vectors and are interchangeable. The vector index stores which provider generated each embedding, so you can mix providers across different corpora without conflicts.

## Best Practices

1. **Trust the router** — The default thresholds are tuned on a wide range of query types. Only adjust them if you observe consistent misrouting.
2. **Watch for T0 over-classification** — If the agent frequently answers "I don't know" or gives stale answers, the T0 threshold may be too low, causing queries that need retrieval to skip it.
3. **Monitor T3 frequency** — If more than 10-15% of queries hit T3, either the thresholds need tuning or the knowledge base needs better indexing.
4. **Scope queries when possible** — Telling the router which corpus to search reduces noise and speeds up retrieval.
5. **Keep embeddings fresh** — When content is updated, re-index the affected chunks. Stale embeddings lead to retrieval misses regardless of tier.
6. **Use T2 for relational queries** — Any query involving relationships, connections, or comparisons benefits from graph expansion. If users frequently ask these types of questions, consider lowering the T2 threshold.
7. **Profile latency** — Use the router's built-in latency metrics to identify bottlenecks. If T2 is slow, the graph index may need optimization.
8. **Explain the tier** — When a user seems surprised by response speed or depth, you can explain which tier was used and why. This builds trust in the system.
