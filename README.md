<p align="center">
  <a href="https://agentos.sh"><img src="logos/agentos-primary-no-tagline-transparent-2x.png" alt="AgentOS" height="56" /></a>
  &nbsp;&nbsp;&nbsp;
  <a href="https://frame.dev"><img src="logos/frame-logo-green-no-tagline.svg" alt="Frame.dev" height="36" /></a>
</p>

# @framers/agentos-skills-registry

Curated catalog of 40+ AgentOS skills with query helpers and lazy-loading factories.

[![npm](https://img.shields.io/npm/v/@framers/agentos-skills-registry?logo=npm&color=cb3837)](https://www.npmjs.com/package/@framers/agentos-skills-registry)

```bash
npm install @framers/agentos-skills-registry
```

## What This Package Is

This is the **skills catalog** — the data layer that ships 40+ curated SKILL.md
prompt modules and provides typed query helpers, search functions, and lazy-loading
factories for consuming them.

It is **not** the skills engine. The engine lives in
[`@framers/agentos-skills`](https://www.npmjs.com/package/@framers/agentos)
(exported from `@framers/agentos/skills`), which provides the runtime
`SkillRegistry`, `SkillSnapshot` builder, frontmatter parser, and eligibility
resolver.

### Architecture: catalog vs. engine

```
@framers/agentos              ← the skills ENGINE (runtime)
  └── /skills                    SkillRegistry, SkillSnapshot, parser, eligibility
        ▲
        │  lazy import()
        │
@framers/agentos-skills-registry   ← THIS package (CATALOG)
  ├── registry/curated/*/SKILL.md  40+ bundled prompt modules
  ├── registry.json                machine-readable index of all skills
  ├── catalog.ts                   SKILLS_CATALOG array + query helpers (zero deps)
  └── index.ts                     factory functions that lazy-import the engine
```

**Dependency direction:** this catalog package depends on `@framers/agentos`
(optional peer dep), never the other way around. The engine knows nothing about
the catalog — it just provides the parsing and registry machinery.

## Quick Start

### 1. Browse the catalog (zero peer deps)

The `./catalog` sub-export has no peer dependencies:

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

// Search across names, descriptions, and tags
const matches = searchSkills('github');

// Filter by category
const social = getSkillsByCategory('social-automation');

// Filter by installed tools
const available = getAvailableSkills(['web-search', 'filesystem']);

// Get a specific skill
const github = getSkillByName('github');
console.log(github?.requiredSecrets); // ['github.token']

// All unique categories
const categories = getCategories();
// ['automation', 'communication', 'creative', 'developer-tools', 'social-automation', ...]
```

### 2. Load raw registry data

Access the JSON index directly:

```typescript
import { getSkillsCatalog } from '@framers/agentos-skills-registry';

const catalog = await getSkillsCatalog();
console.log(catalog.skills.curated.length); // 40+
console.log(catalog.version); // '1.0.0'
```

Or import the raw JSON:

```typescript
import registry from '@framers/agentos-skills-registry/registry.json';
console.log(registry.skills.curated[0].name); // 'weather'
```

### 3. Dynamically load skills into an agent (requires @framers/agentos)

The factory functions lazy-import `@framers/agentos/skills` (the engine) via
dynamic `import()` — resolved only when you call them, cached after first use:

```bash
npm install @framers/agentos-skills-registry @framers/agentos
```

```typescript
import {
  createCuratedSkillRegistry,
  createCuratedSkillSnapshot,
  getBundledCuratedSkillsDir,
  loadSkillByName,
} from '@framers/agentos-skills-registry';

// Option A: Create a live SkillRegistry loaded with all curated skills
const registry = await createCuratedSkillRegistry();

// Or load only a specific curated subset
const selectedRegistry = await createCuratedSkillRegistry({
  skills: ['github', 'weather'],
});

// Option B: Build a prompt snapshot for specific skills
const snapshot = await createCuratedSkillSnapshot({
  skills: ['github', 'weather', 'notion'], // or 'all'
  platform: 'darwin',
});

// Only the selected skills are loaded when you pass an explicit list.
console.log(snapshot.skills.map((skill) => skill.name));
// ['github', 'weather', 'notion']

// Inject the snapshot prompt into your agent's system message
const systemPrompt = `You are an AI assistant.\n\n${snapshot.prompt}`;

// Option C: Load a single SKILL.md lazily with parsed metadata
const githubSkill = await loadSkillByName('github');
console.log(githubSkill?.metadata?.primaryEnv); // 'GITHUB_TOKEN'
console.log(githubSkill?.frontmatter.requires_tools); // ['filesystem']

// Option D: Get the directory path and load manually
const skillsDir = getBundledCuratedSkillsDir();
// → '/path/to/node_modules/@framers/agentos-skills-registry/registry/curated'
```

### 4. Dynamic skill resolution in Wunderland presets

```typescript
// In agent.config.json:
// { "suggestedSkills": ["github", "web-search", "notion"] }

import { getSkillByName } from '@framers/agentos-skills-registry/catalog';
import { createCuratedSkillSnapshot } from '@framers/agentos-skills-registry';

// Validate skill names exist before loading
const skillNames = ['github', 'web-search', 'notion'];
const valid = skillNames.filter((name) => {
  const entry = getSkillByName(name);
  if (!entry) {
    console.warn(`Unknown skill "${name}", skipping`);
    return false;
  }
  return true;
});

// Build snapshot with only validated skills
const snapshot = await createCuratedSkillSnapshot({ skills: valid });
```

When `skills` is a string array, the catalog only loads those specific `SKILL.md`
files before building the snapshot. It does not walk the full curated bundle first.
Loaded skills also include parsed `metadata` so consumers do not need to decode
the `metadata.agentos` block manually.

## Sub-exports

| Export path | Peer deps | Use case |
|-------------|-----------|----------|
| `@framers/agentos-skills-registry` | `@framers/agentos` (optional) | Full SDK: catalog + factory functions + schema types |
| `@framers/agentos-skills-registry/catalog` | None | Lightweight: `SKILLS_CATALOG`, query helpers (search, filter, browse) |
| `@framers/agentos-skills-registry/registry.json` | None | Raw JSON index of all skills |
| `@framers/agentos-skills-registry/workspace-discovery` | None | Discover SKILL.md files in workspace directories |
| `@framers/agentos-skills-registry/types` | None | TypeScript declarations for registry.json schema |

The `@framers/agentos` dependency is loaded **lazily** at runtime and cached after first resolution. If it is not installed and you call a factory function, you get a clear error with install instructions. The catalog query helpers work without it.

## Included Skills (40+)

The catalog includes both foundational utility skills and social automation modules:

- Information and research: `web-search`, `weather`, `summarize`, `deep-research`
- Developer tools: `github`, `coding-agent`, `git`
- Productivity: `notion`, `obsidian`, `trello`, `apple-notes`, `apple-reminders`
- Social automation: `social-broadcast`, `twitter-bot`, `instagram-bot`, `linkedin-bot`, `facebook-bot`, `threads-bot`, `bluesky-bot`, `mastodon-bot`, `youtube-bot`, `tiktok-bot`, `pinterest-bot`, `reddit-bot`, `blog-publisher`
- Additional categories: `automation`, `communication`, `devops`, `media`, `marketing`, `creative`, `security`

## Community Skills

The catalog supports both **curated** (staff-maintained) and **community** (PR-submitted) skills:

```typescript
import { getCuratedSkills, getCommunitySkills } from '@framers/agentos-skills-registry/catalog';

const curated = getCuratedSkills();   // Staff-verified skills
const community = getCommunitySkills(); // Community-contributed
```

Each entry includes a `source` field (`'curated'` or `'community'`) for provenance filtering.

## Schema Types

Import registry.json schema types for type-safe access:

```typescript
import type {
  SkillRegistryEntry,
  SkillsRegistry,
  SkillInstallSpec,
  SkillMetadata,
} from '@framers/agentos-skills-registry';

// SkillRegistryEntry — shape of entries in registry.json
// SkillsRegistry — shape of the full registry.json file
// SkillInstallSpec — install instructions for skill dependencies
```

## Contributing

See [CONTRIBUTING.md](./CONTRIBUTING.md) for how to submit new skills.

## License

MIT
