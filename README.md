# @framers/agentos-skills-registry

Curated skills registry bundle for [AgentOS](https://github.com/framersai/agentos) — lazy-loading DI of SKILL.md prompt modules.

[![npm](https://img.shields.io/npm/v/@framers/agentos-skills-registry?logo=npm&color=cb3837)](https://www.npmjs.com/package/@framers/agentos-skills-registry)

```bash
npm install @framers/agentos-skills-registry
```

## What's Inside

This package is the **typed SDK** on top of [`@framers/agentos-skills`](https://www.npmjs.com/package/@framers/agentos-skills). It provides:

- **Static catalog** (`SKILLS_CATALOG`) — typed array of all 18 curated skills with metadata
- **Query helpers** — `searchSkills()`, `getSkillsByCategory()`, `getSkillsByTag()`, `getAvailableSkills()`, etc.
- **Registry factories** — `createCuratedSkillRegistry()`, `createCuratedSkillSnapshot()` (requires `@framers/agentos`)

## Two Import Paths

### Lightweight (zero peer deps)

The `./catalog` sub-export works standalone — no `@framers/agentos` needed:

```typescript
import {
  SKILLS_CATALOG,
  searchSkills,
  getSkillsByCategory,
  getSkillByName,
  getAvailableSkills,
  getCategories,
  getSkillsByTag,
} from '@framers/agentos-skills-registry/catalog';

// Search
const matches = searchSkills('github');

// Filter by category
const devTools = getSkillsByCategory('developer-tools');

// Filter by installed tools
const available = getAvailableSkills(['web-search', 'filesystem']);

// All categories
const categories = getCategories();
// ['communication', 'creative', 'developer-tools', 'devops', 'information', ...]
```

### Full registry (requires @framers/agentos)

The factory functions lazy-load `@framers/agentos` via `dynamic import()` — only resolved when called:

```bash
npm install @framers/agentos-skills-registry @framers/agentos
```

```typescript
import {
  createCuratedSkillRegistry,
  createCuratedSkillSnapshot,
} from '@framers/agentos-skills-registry';

// Create a live SkillRegistry loaded with all curated skills
const registry = await createCuratedSkillRegistry();
console.log(registry.size); // 18

// Build a prompt snapshot for agent injection
const snapshot = await createCuratedSkillSnapshot({
  skills: ['github', 'weather', 'notion'], // or 'all'
  platform: 'darwin',
});
console.log(snapshot.prompt); // Formatted markdown for the LLM
```

If `@framers/agentos` is not installed and you call a factory function, you get a clear error:

```
Error: @framers/agentos is required for createCuratedSkillRegistry() and
createCuratedSkillSnapshot().  Install it:

  npm install @framers/agentos

Or use the lightweight catalog helpers (getSkillsByCategory, searchSkills, etc.)
which have no peer-dep requirement.
```

## Lazy Loading

The `@framers/agentos` dependency is loaded **lazily** at runtime via dynamic `import()` and cached after first resolution. This means:

- `import { searchSkills } from '@framers/agentos-skills-registry/catalog'` — **zero** peer deps loaded
- `import { createCuratedSkillRegistry } from '@framers/agentos-skills-registry'` — `@framers/agentos` loaded **only when called**

## Community Skills

The catalog includes both **curated** (staff-maintained) and **community** (PR-submitted) skills. Use the source-aware helpers to filter by origin:

```typescript
import {
  getCuratedSkills,
  getCommunitySkills,
  getAllSkills,
} from '@framers/agentos-skills-registry/catalog';

// Only staff-maintained, verified skills
const curated = getCuratedSkills();

// Only community-contributed skills
const community = getCommunitySkills();

// Everything (curated + community)
const all = getAllSkills();

// Combine with existing filters
import { getSkillsByCategory } from '@framers/agentos-skills-registry/catalog';

const devTools = getSkillsByCategory('developer-tools');
const curatedDevTools = devTools.filter((s) => s.source === 'curated');
const communityDevTools = devTools.filter((s) => s.source === 'community');
```

Each skill entry includes a `source` field (`'curated'` or `'community'`) so you can distinguish provenance at runtime.

## Relationship to Other Packages

```
@framers/agentos-skills              (data: SKILL.md files + JSON index)
  └── @framers/agentos-skills-registry   ← You are here (SDK: typed queries + factories)
        └── @framers/agentos             (optional peer: live SkillRegistry + snapshots)
```

## License

MIT
