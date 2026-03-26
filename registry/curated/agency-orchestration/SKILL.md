---
name: agency-orchestration
version: '1.0.0'
description: Multi-agent orchestration via the agency() API — 6 strategies (sequential, parallel, debate, review-loop, hierarchical, graph), HITL approval, and nested agencies.
author: Wunderland
namespace: wunderland
category: orchestration
tags: [agency, multi-agent, orchestration, sequential, parallel, debate, graph, HITL]
requires_secrets: []
requires_tools: []
metadata:
  agentos:
    emoji: "\U0001F3DB"
---

# Agency Orchestration

You can coordinate multiple agents using the `agency()` API, which provides six execution strategies for multi-agent workflows. Use this when a task is too complex or broad for a single agent, when you need diverse perspectives, or when quality demands iterative review.

## The Six Strategies

### 1. Sequential

Agents execute one after another in a defined order. Each agent receives the accumulated output of all preceding agents.

- **Use when**: Tasks have natural stages (research → draft → edit → publish)
- **Behavior**: Agent A runs, its output feeds Agent B, then Agent C, etc.
- **Failure**: If any agent fails, the pipeline halts and returns the error with partial results

### 2. Parallel

All agents execute concurrently on the same input. Results are collected and merged.

- **Use when**: You need independent perspectives on the same input (e.g., multiple reviewers, multi-language translation)
- **Behavior**: All agents start simultaneously, results are aggregated once all complete
- **Failure**: Partial results are returned for agents that succeed; failures are reported alongside

### 3. Debate

Two or more agents argue opposing positions through multiple rounds, converging toward a refined answer.

- **Use when**: The problem benefits from adversarial reasoning — ambiguous questions, ethical dilemmas, design tradeoffs
- **Behavior**: Each round, agents see all previous arguments and must respond. A moderator agent (or the orchestrator) synthesizes the final position after the configured number of rounds
- **Configuration**: Set `rounds` (default 3) and optionally a `moderator` agent

### 4. Review-Loop

One agent produces output, another reviews it, and the cycle repeats until the reviewer approves or the max iteration count is reached.

- **Use when**: Quality is paramount — code generation, legal drafts, safety-critical content
- **Behavior**: Producer generates → Reviewer evaluates → if rejected, Producer revises using feedback → repeat
- **Configuration**: Set `maxIterations` (default 3) and `approvalThreshold` (0-1 confidence score)

### 5. Hierarchical

A supervisor agent delegates subtasks to worker agents, collects results, and synthesizes a final output.

- **Use when**: Complex projects with distinct subtasks that need coordination — project planning, multi-part research
- **Behavior**: Supervisor decomposes the task, assigns each part to a specialist worker, monitors progress, and assembles the final deliverable
- **Configuration**: Define the `supervisor` agent and `workers` array with their specialties

### 6. Graph

Agents are wired into a directed acyclic graph (DAG) with explicit `dependsOn` edges. Agents execute as soon as all their dependencies have completed.

- **Use when**: Complex workflows with branching and merging — CI/CD pipelines, data processing DAGs, multi-stage analysis
- **Behavior**: The scheduler resolves the topological order and maximizes parallelism within dependency constraints
- **Configuration**: Each agent node specifies `dependsOn: [agentIds]` to declare prerequisites

## dependsOn Graph Wiring

For the graph strategy (and implicit dependency tracking in other strategies), use `dependsOn` to declare edges:

```
agency({
  strategy: 'graph',
  agents: [
    { id: 'fetcher', agent: fetchAgent },
    { id: 'parser', agent: parseAgent, dependsOn: ['fetcher'] },
    { id: 'analyzer', agent: analyzeAgent, dependsOn: ['parser'] },
    { id: 'summarizer', agent: summaryAgent, dependsOn: ['parser'] },
    { id: 'reporter', agent: reportAgent, dependsOn: ['analyzer', 'summarizer'] },
  ]
})
```

The scheduler automatically parallelizes `analyzer` and `summarizer` since they share the same dependency but not each other.

## HITL (Human-in-the-Loop) Approval

Any strategy can be configured with HITL checkpoints where execution pauses and waits for human approval before proceeding:

- **Gate placement** — Add `hitl: true` to any agent node, or set `hitlAfterStep: [stepIndices]` on the agency
- **Approval UI** — The system presents the intermediate output and waits for approve/reject/modify
- **Timeout** — Configure `hitlTimeoutMs` (default: no timeout, waits indefinitely)
- **Rejection** — If the human rejects, the previous agent receives the rejection reason and can revise

Use HITL for high-stakes decisions: publishing content, sending emails, executing financial transactions, or any irreversible action.

## Nested Agencies

Agencies can be nested — any agent in an agency can itself be an agency:

- A hierarchical supervisor can delegate to a review-loop sub-agency
- A sequential pipeline can include a debate stage as one of its steps
- A graph node can trigger a parallel fan-out sub-agency

Nesting allows you to compose sophisticated multi-agent workflows from simple building blocks. Keep nesting shallow (2-3 levels) to maintain debuggability.

## Agency Streaming

Results from agencies can be streamed in real time:

- **Per-agent streaming** — Each agent's output tokens stream as they are generated
- **Progress events** — The orchestrator emits events when agents start, complete, or fail
- **Partial results** — Consumers can inspect intermediate state without waiting for the full agency to complete

Enable streaming with `stream: true` in the agency configuration. This is especially useful for long-running agencies where the user wants to see progress.

## Best Practices

1. **Match strategy to problem** — Sequential for pipelines, parallel for independent perspectives, debate for ambiguity, review-loop for quality, hierarchical for complex delegation, graph for DAGs.
2. **Keep agents focused** — Each agent in an agency should have a narrow, well-defined role. Broad agents produce vague results.
3. **Set iteration limits** — Always configure `maxIterations` for review-loops and `rounds` for debates to prevent runaway execution.
4. **Use HITL for irreversible actions** — Never let an automated agency publish, send, or delete without human approval unless explicitly authorized.
5. **Start simple** — Begin with sequential or parallel before reaching for graph or hierarchical. Simpler strategies are easier to debug.
6. **Monitor token budgets** — Multi-agent workflows multiply token usage. Set per-agent token limits when cost is a concern.
7. **Test with small inputs** — Validate your agency wiring with trivial inputs before running expensive full-scale tasks.
8. **Log everything** — Enable verbose logging during development. Multi-agent failures are hard to diagnose without execution traces.
