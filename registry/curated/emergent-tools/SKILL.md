---
name: emergent-tools
version: '1.0.0'
description: Forge new tools at runtime via LLM — sandboxed execution, LLM-as-judge validation, composable tool building, and full audit trail.
author: Wunderland
namespace: wunderland
category: productivity
tags: [emergent, tools, forge, sandbox, dynamic, runtime, LLM-judge]
requires_secrets: []
requires_tools: [forge_tool]
metadata:
  agentos:
    emoji: "\U0001F527"
---

# Emergent Tools

You have access to the EmergentCapabilityEngine — a system that lets you create brand-new tools at runtime when no existing tool satisfies the user's request. This is a powerful capability; use it wisely.

## When to Forge vs. Use Existing Tools

Before forging a new tool, always check whether an existing tool can fulfill the request:

1. **Search first** — Use `discover_capabilities` to scan the tool registry. If a tool already exists that handles the task (even partially), prefer it.
2. **Compose second** — If two or more existing tools can be chained together to accomplish the goal, use the ComposableToolBuilder to wire them rather than creating something from scratch.
3. **Forge last** — Only forge a genuinely new tool when no existing tool or composition covers the need. Common forge-worthy scenarios:
   - A domain-specific data transformation not covered by general utilities
   - A custom API integration the user needs on the fly
   - A specialized validation or formatting pipeline
   - A one-off computation that would be awkward to express as a prompt

## The Forging Process

When you decide to forge a tool, the pipeline works as follows:

1. **Specification** — You describe the tool's purpose, input schema, output schema, and expected behavior in natural language.
2. **LLM generation** — The EmergentCapabilityEngine uses an LLM to produce the tool implementation (TypeScript function body).
3. **Sandboxed execution** — The generated code runs in an isolated sandbox with no filesystem, network, or process access by default. The sandbox enforces strict resource limits (CPU time, memory, output size).
4. **LLM-as-judge validation** — A separate LLM call evaluates whether the tool's output matches the specification. The judge scores correctness, safety, and completeness.
5. **Registry enrollment** — If the tool passes validation, it is registered in the runtime tool registry with full metadata and an audit trail entry.

## Using ForgeToolMetaTool

The `forge_tool` meta-tool is your interface to the EmergentCapabilityEngine. Invoke it with:

- **name** — A clear, snake_case identifier for the new tool (e.g., `csv_to_markdown_table`)
- **description** — What the tool does, written as if for another agent reading a tool list
- **input_schema** — JSON Schema describing the expected input
- **output_schema** — JSON Schema describing the expected output
- **examples** — At least one input/output example pair to guide generation and validation
- **constraints** — Optional safety constraints (e.g., "must not make network calls", "output must be valid JSON")

The more precise your specification, the higher the first-pass success rate.

## ComposableToolBuilder

For compositions of existing tools, use the ComposableToolBuilder pattern:

- **pipeline(tools[])** — Chain tools sequentially, piping each output as the next input
- **parallel(tools[])** — Run tools concurrently and merge their outputs
- **conditional(predicate, ifTool, elseTool)** — Branch based on a runtime condition
- **transform(tool, mapFn)** — Wrap a tool with an output transformation

Composed tools are registered just like forged tools, with full provenance tracking showing which base tools were combined.

## EmergentJudge Quality Thresholds

The LLM-as-judge system uses three thresholds:

- **Correctness** (>= 0.8) — Does the output match the specification and examples?
- **Safety** (>= 0.9) — Does the tool avoid side effects, data leaks, or dangerous operations?
- **Completeness** (>= 0.7) — Does the tool handle edge cases and produce well-structured output?

If any threshold is not met, the forge attempt fails with a detailed explanation. You can revise the specification and retry. Typically, adding more examples or tightening constraints resolves most failures.

## Audit Trail

Every forged tool carries an audit record containing:

- The original specification
- The generated source code (hash-pinned)
- Judge scores and rationale
- Timestamp and session context
- Parent tool references (for compositions)

This trail is immutable. If a user asks "how was this tool made?", you can retrieve and explain its provenance.

## Best Practices

1. **Start with examples** — Providing 2-3 input/output examples dramatically improves forge quality.
2. **Keep tools focused** — Forge small, single-purpose tools rather than monolithic ones. Compose them later if needed.
3. **Set constraints explicitly** — If the tool must not access the network or must produce valid JSON, state it in constraints.
4. **Validate before relying** — After forging, test the tool with a known input before using it in a critical workflow.
5. **Reuse forged tools** — Forged tools persist in the session registry. Check before forging a duplicate.
6. **Name descriptively** — Good names make forged tools discoverable by other agents and future sessions.
7. **Monitor judge feedback** — If the judge rejects a tool, read the rationale carefully. It usually pinpoints exactly what to fix.
8. **Prefer composition** — A pipeline of three proven tools is more reliable than one complex forged tool.
