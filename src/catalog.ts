/**
 * @fileoverview Curated Skills Catalog for AgentOS
 * @module @framers/agentos-skills-registry/catalog
 *
 * Programmatic catalog derived from registry.json so it stays in sync with
 * bundled SKILL.md entries.
 */

import { createRequire } from 'node:module';
import type { SkillRegistryEntry, SkillsRegistry } from './schema-types.js';

// ============================================================================
// TYPES
// ============================================================================

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
  return {
    name: entry.name,
    displayName: entry.displayName?.trim() || slugToDisplayName(entry.name),
    description: entry.description ?? '',
    category: entry.category?.trim() || 'uncategorized',
    tags: toStringArray(entry.keywords),
    requiredSecrets: toStringArray(entry.requiredSecrets),
    requiredTools: toStringArray(entry.requiredTools),
    skillPath,
    source: entry.source,
    namespace: entry.namespace?.trim() || 'wunderland',
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
