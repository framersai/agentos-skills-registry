/**
 * @fileoverview Curated Skills Catalog for AgentOS
 * @module @framers/agentos-skills-registry/catalog
 *
 * Programmatic catalog derived from registry.json so it stays in sync with
 * bundled SKILL.md entries.
 *
 * Pattern mirrors `@framers/agentos-extensions-registry/tool-registry`:
 *   - `SKILLS_CATALOG` array with metadata + lazy `loadSkill` factory
 *   - `createLocalSkillProxy()` for lazy-loading from local paths
 *   - `loadSkillByName()` for on-demand loading by name
 */

import * as path from 'node:path';
import * as fs from 'node:fs/promises';
import { createRequire } from 'node:module';
import type { SkillRegistryEntry, SkillsRegistry } from './schema-types.js';

// ============================================================================
// TYPES
// ============================================================================

/**
 * Result of loading a skill via its `loadSkill()` factory.
 *
 * Contains the parsed SKILL.md content, frontmatter, and body text — everything
 * needed to inject the skill into an agent's prompt context.
 */
export interface LoadedSkill {
  /** Skill name */
  name: string;

  /** Human-readable display name */
  displayName: string;

  /** Brief description */
  description: string;

  /** Full SKILL.md body content (after frontmatter) */
  content: string;

  /** Raw parsed frontmatter key/value pairs */
  frontmatter: Record<string, unknown>;

  /** Absolute path to the SKILL.md file that was loaded */
  sourcePath: string;
}

export interface SkillCatalogEntry {
  /** Unique skill name (matches directory name under registry/curated/) */
  name: string;

  /** Human-readable display name */
  displayName: string;

  /** Brief description of the skill's capabilities */
  description: string;

  /** Skill category for grouping */
  category: string;

  /** Searchable tags */
  tags: string[];

  /** Secret identifiers the skill needs (e.g. 'github.token') */
  requiredSecrets: string[];

  /** Tool identifiers the skill depends on (e.g. 'web-search', 'filesystem') */
  requiredTools: string[];

  /** Relative path from the package root to the SKILL.md */
  skillPath: string;

  /** Skill source: curated (staff-maintained) or community-submitted */
  source?: 'curated' | 'community';

  /** Namespace used by the skill registry */
  namespace: string;

  /** Whether this skill is available (SKILL.md exists on disk). Always true for bundled skills. */
  available: boolean;

  /**
   * Lazy factory function that loads and parses the SKILL.md on demand.
   *
   * Mirrors the `createPack` pattern from `@framers/agentos-extensions-registry`.
   * Returns parsed skill content including frontmatter and body text.
   */
  loadSkill: () => Promise<LoadedSkill>;
}

// ============================================================================
// PATH HELPERS
// ============================================================================

const __dirname = path.dirname(new URL(import.meta.url).pathname);

/** Package root (one level up from dist/ or src/) */
function resolvePackageRoot(): string {
  return path.resolve(__dirname, '..');
}

// ============================================================================
// LAZY SKILL LOADER (mirrors createLocalPackProxy from extensions-registry)
// ============================================================================

/** Resolved module cache for @framers/agentos SkillLoader — loaded at most once. */
let _skillLoaderMod: {
  parseSkillFrontmatter: (content: string) => {
    frontmatter: Record<string, unknown>;
    body: string;
  };
} | null = null;

/**
 * Attempt to lazily import the SkillLoader from @framers/agentos.
 * Falls back to a lightweight built-in parser if the peer dep is unavailable.
 */
async function getSkillParser(): Promise<NonNullable<typeof _skillLoaderMod>> {
  if (_skillLoaderMod) return _skillLoaderMod;

  try {
    const mod = await import('@framers/agentos/skills');
    _skillLoaderMod = {
      parseSkillFrontmatter: (mod as any).parseSkillFrontmatter,
    };
    return _skillLoaderMod;
  } catch {
    // Fallback: lightweight YAML frontmatter parser (no heavy deps)
    _skillLoaderMod = {
      parseSkillFrontmatter: builtinParseSkillFrontmatter,
    };
    return _skillLoaderMod;
  }
}

/**
 * Built-in lightweight frontmatter parser used when @framers/agentos is not
 * installed. Handles the standard `---` delimited YAML frontmatter format
 * with simple key: value pairs and arrays.
 */
function builtinParseSkillFrontmatter(content: string): {
  frontmatter: Record<string, unknown>;
  body: string;
} {
  const normalized = content.replace(/\r\n/g, '\n').replace(/\r/g, '\n');
  const lines = normalized.split('\n');

  if (lines[0]?.trim() !== '---') {
    return { frontmatter: {}, body: normalized.trim() };
  }

  let endIndex = -1;
  for (let i = 1; i < lines.length; i++) {
    if (lines[i]?.trim() === '---') {
      endIndex = i;
      break;
    }
  }

  if (endIndex === -1) {
    return { frontmatter: {}, body: normalized.trim() };
  }

  const frontmatterBlock = lines.slice(1, endIndex).join('\n');
  const body = lines.slice(endIndex + 1).join('\n').trim();

  const result: Record<string, unknown> = {};
  const fmLines = frontmatterBlock.split('\n');
  let i = 0;

  while (i < fmLines.length) {
    const line = fmLines[i];
    if (!line.trim() || /^\s{2,}\S/.test(line)) {
      i++;
      continue;
    }

    const kvMatch = line.match(/^(\w[\w_-]*)\s*:\s*(.*)/);
    if (!kvMatch) {
      i++;
      continue;
    }

    const key = kvMatch[1];
    const rawValue = kvMatch[2].trim();

    // Inline array: [a, b, c]
    if (rawValue.startsWith('[') && rawValue.endsWith(']')) {
      const inner = rawValue.slice(1, -1);
      result[key] = inner
        ? inner.split(',').map((s) => s.trim().replace(/^['"]|['"]$/g, ''))
        : [];
      i++;
      continue;
    }

    // Block array or empty value
    if (rawValue === '' || rawValue === '[]') {
      const items: string[] = [];
      let j = i + 1;
      while (j < fmLines.length) {
        const next = fmLines[j];
        const itemMatch = next.match(/^\s+-\s+(.*)/);
        if (!itemMatch) break;
        items.push(itemMatch[1].trim().replace(/^['"]|['"]$/g, ''));
        j++;
      }
      if (items.length > 0) {
        result[key] = items;
        i = j;
        continue;
      }
      if (rawValue === '[]') {
        result[key] = [];
        i++;
        continue;
      }
    }

    // Scalar value
    result[key] = rawValue.replace(/^['"]|['"]$/g, '');
    i++;
  }

  return { frontmatter: result, body };
}

/**
 * Create a lazy-loading skill proxy for a relative SKILL.md path.
 *
 * Mirrors `createLocalPackProxy()` from the extensions-registry: the SKILL.md
 * is only read and parsed when the returned function is called.
 *
 * @param relativePath - Path from the package root to the SKILL.md file
 *                       (e.g. 'registry/curated/github/SKILL.md')
 * @param displayName  - Human-readable display name for the loaded skill
 */
export function createLocalSkillProxy(
  relativePath: string,
  displayName: string,
): () => Promise<LoadedSkill> {
  return async () => {
    const absolutePath = path.resolve(resolvePackageRoot(), relativePath);

    let content: string;
    try {
      content = await fs.readFile(absolutePath, 'utf-8');
    } catch (err) {
      throw new Error(
        `Failed to load SKILL.md at ${absolutePath}: ${err instanceof Error ? err.message : String(err)}`
      );
    }

    const parser = await getSkillParser();
    const { frontmatter, body } = parser.parseSkillFrontmatter(content);

    const name =
      typeof frontmatter.name === 'string' && frontmatter.name.trim()
        ? frontmatter.name.trim()
        : path.basename(path.dirname(absolutePath));

    const description =
      typeof frontmatter.description === 'string' && frontmatter.description.trim()
        ? frontmatter.description.trim()
        : body.split('\n').find((l) => l.trim() && !l.startsWith('#'))?.trim() ?? '';

    return {
      name,
      displayName,
      description,
      content: body,
      frontmatter,
      sourcePath: absolutePath,
    };
  };
}

// ============================================================================
// CATALOG BUILD
// ============================================================================

const require = createRequire(import.meta.url);
const registry = require('../registry.json') as SkillsRegistry;

function toStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.filter((v): v is string => typeof v === 'string' && v.trim().length > 0);
}

function slugToDisplayName(slug: string): string {
  return slug
    .split(/[-_]/g)
    .filter(Boolean)
    .map((part) => part[0].toUpperCase() + part.slice(1))
    .join(' ');
}

function toCatalogEntry(entry: SkillRegistryEntry): SkillCatalogEntry {
  const skillPath = `${entry.path}/SKILL.md`;
  const entryDisplayName = entry.displayName?.trim() || slugToDisplayName(entry.name);
  return {
    name: entry.name,
    displayName: entryDisplayName,
    description: entry.description ?? '',
    category: entry.category?.trim() || 'uncategorized',
    tags: toStringArray(entry.keywords),
    requiredSecrets: toStringArray(entry.requiredSecrets),
    requiredTools: toStringArray(entry.requiredTools),
    skillPath,
    source: entry.source,
    namespace: entry.namespace?.trim() || 'wunderland',
    available: true,
    loadSkill: createLocalSkillProxy(skillPath, entryDisplayName),
  };
}

const curated = (registry.skills?.curated ?? []).map(toCatalogEntry);
const community = (registry.skills?.community ?? []).map(toCatalogEntry);

export const SKILLS_CATALOG: SkillCatalogEntry[] = [...curated, ...community].sort((a, b) =>
  a.name.localeCompare(b.name)
);

// ============================================================================
// QUERY HELPERS
// ============================================================================

/**
 * Get all skills in a given category.
 */
export function getSkillsByCategory(category: string): SkillCatalogEntry[] {
  return SKILLS_CATALOG.filter((s) => s.category === category);
}

/**
 * Get a skill by its unique name.
 */
export function getSkillByName(name: string): SkillCatalogEntry | undefined {
  return SKILLS_CATALOG.find((s) => s.name === name);
}

/**
 * Get skills whose required tools are all present in the provided list.
 *
 * Skills with no required tools are always considered available.
 */
export function getAvailableSkills(installedTools: string[]): SkillCatalogEntry[] {
  const toolSet = new Set(installedTools);
  return SKILLS_CATALOG.filter((s) => s.requiredTools.every((t) => toolSet.has(t)));
}

/**
 * Get all unique categories across the catalog.
 */
export function getCategories(): string[] {
  return [...new Set(SKILLS_CATALOG.map((s) => s.category))].sort();
}

/**
 * Search skills by tag (returns all skills that have at least one matching tag).
 */
export function getSkillsByTag(tag: string): SkillCatalogEntry[] {
  const lower = tag.toLowerCase();
  return SKILLS_CATALOG.filter((s) => s.tags.some((t) => t.toLowerCase() === lower));
}

/**
 * Full-text search across skill names, descriptions, and tags.
 */
export function searchSkills(query: string): SkillCatalogEntry[] {
  const lower = query.toLowerCase();
  return SKILLS_CATALOG.filter(
    (s) =>
      s.name.toLowerCase().includes(lower) ||
      s.displayName.toLowerCase().includes(lower) ||
      s.description.toLowerCase().includes(lower) ||
      s.tags.some((t) => t.toLowerCase().includes(lower))
  );
}

/**
 * Get only staff-curated skills.
 */
export function getCuratedSkills(): SkillCatalogEntry[] {
  return SKILLS_CATALOG.filter((s) => s.source === 'curated');
}

/**
 * Get only community-submitted skills.
 */
export function getCommunitySkills(): SkillCatalogEntry[] {
  return SKILLS_CATALOG.filter((s) => s.source === 'community');
}

/**
 * Get all skills (curated + community). Alias for SKILLS_CATALOG.
 */
export function getAllSkills(): SkillCatalogEntry[] {
  return SKILLS_CATALOG;
}

/**
 * Get skill entries filtered by name.
 *
 * Mirrors `getToolEntries()` from the extensions-registry.
 */
export function getSkillEntries(names?: string[] | 'all' | 'none'): SkillCatalogEntry[] {
  if (names === 'none') return [];
  if (!names || names === 'all') return [...SKILLS_CATALOG];
  return SKILLS_CATALOG.filter((entry) => names.includes(entry.name));
}

// ============================================================================
// ON-DEMAND SKILL LOADING
// ============================================================================

/**
 * Load a skill by name from the catalog.
 *
 * Finds the entry in SKILLS_CATALOG and calls its `loadSkill()` factory to
 * read and parse the SKILL.md file on demand. Returns `null` if the skill
 * is not found in the catalog.
 *
 * This is the primary consumer-facing API for lazy skill loading, mirroring
 * how the extensions-registry resolves and loads extension packs.
 *
 * @example
 * ```typescript
 * import { loadSkillByName } from '@framers/agentos-skills-registry';
 *
 * const skill = await loadSkillByName('github');
 * if (skill) {
 *   console.log(skill.content); // SKILL.md body for injection into prompt
 * }
 * ```
 */
export async function loadSkillByName(name: string): Promise<LoadedSkill | null> {
  const entry = SKILLS_CATALOG.find((s) => s.name === name);
  if (!entry) return null;
  return entry.loadSkill();
}

/**
 * Load multiple skills by name from the catalog.
 *
 * Convenience wrapper that calls `loadSkillByName()` for each name in parallel.
 * Silently skips skills that are not found in the catalog.
 */
export async function loadSkillsByNames(names: string[]): Promise<LoadedSkill[]> {
  const results = await Promise.all(names.map((n) => loadSkillByName(n)));
  return results.filter((r): r is LoadedSkill => r !== null);
}
