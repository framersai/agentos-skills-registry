/**
 * @fileoverview Cross-Agent Skill Discovery (Feature 3.5)
 *
 * Discovers SKILL.md files from a workspace `.agents/skills/` directory,
 * parses their YAML frontmatter, and returns them as SkillCatalogEntry[]
 * compatible with the existing registry catalog.
 *
 * Workspace skills take priority over registry skills when names collide.
 *
 * @module @framers/agentos-skills-registry/workspace-discovery
 */

import * as fs from 'node:fs/promises';
import * as path from 'node:path';
import type { SkillCatalogEntry } from './catalog.js';

// ── Frontmatter types ───────────────────────────────────────────────────────

/** Raw frontmatter fields extracted from a workspace SKILL.md */
export interface SkillFrontmatter {
  name: string;
  version?: string;
  description?: string;
  category?: string;
  tags?: string[];
  author?: string;
  namespace?: string;
  requires_secrets?: string[];
  requires_tools?: string[];
  metadata?: Record<string, unknown>;
}

/** Options for workspace skill discovery */
export interface WorkspaceDiscoveryOptions {
  /**
   * Absolute or relative path to the workspace skills directory.
   * Defaults to `.agents/skills/` resolved from `cwd`.
   */
  skillsDir?: string;

  /**
   * Working directory used to resolve relative `skillsDir`.
   * Defaults to `process.cwd()`.
   */
  cwd?: string;
}

// ── Frontmatter parser ──────────────────────────────────────────────────────

/**
 * Lightweight YAML frontmatter parser.
 *
 * Handles the subset of YAML used in SKILL.md frontmatter:
 *   - scalar key: value pairs
 *   - inline arrays  [a, b, c]
 *   - block arrays   (- item)
 *
 * Does NOT pull in a full YAML dependency — keeps the package lightweight.
 */
export function parseSkillFrontmatter(content: string): SkillFrontmatter | null {
  // Extract frontmatter block between leading --- fences
  const match = content.match(/^---\r?\n([\s\S]*?)\r?\n---/);
  if (!match) return null;

  const block = match[1];
  const result: Record<string, unknown> = {};

  const lines = block.split('\n');
  let i = 0;

  while (i < lines.length) {
    const line = lines[i];

    // Skip blank lines and deep-nested keys (metadata sub-objects)
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
    let rawValue = kvMatch[2].trim();

    // Inline array: [a, b, c]
    if (rawValue.startsWith('[') && rawValue.endsWith(']')) {
      const inner = rawValue.slice(1, -1);
      result[key] = inner
        ? inner.split(',').map((s) => s.trim().replace(/^['"]|['"]$/g, ''))
        : [];
      i++;
      continue;
    }

    // Block array: subsequent lines starting with "- "
    if (rawValue === '' || rawValue === '[]') {
      const items: string[] = [];
      let j = i + 1;
      while (j < lines.length) {
        const next = lines[j];
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
      // Empty array literal
      if (rawValue === '[]') {
        result[key] = [];
        i++;
        continue;
      }
    }

    // Scalar value — strip surrounding quotes
    result[key] = rawValue.replace(/^['"]|['"]$/g, '');
    i++;
  }

  // name is required
  if (typeof result.name !== 'string' || !result.name) return null;

  return {
    name: result.name as string,
    version: (result.version as string) ?? undefined,
    description: (result.description as string) ?? undefined,
    category: (result.category as string) ?? undefined,
    tags: Array.isArray(result.tags) ? (result.tags as string[]) : undefined,
    author: (result.author as string) ?? undefined,
    namespace: (result.namespace as string) ?? undefined,
    requires_secrets: Array.isArray(result.requires_secrets)
      ? (result.requires_secrets as string[])
      : undefined,
    requires_tools: Array.isArray(result.requires_tools)
      ? (result.requires_tools as string[])
      : undefined,
    metadata: (result.metadata as Record<string, unknown>) ?? undefined,
  };
}

// ── Skill discovery ─────────────────────────────────────────────────────────

/**
 * Create a lazy-loading skill factory for an absolute SKILL.md path.
 * Used for workspace-discovered skills where the path is already resolved.
 */
function createAbsoluteSkillLoader(
  absolutePath: string,
  displayName: string,
): () => Promise<import('./catalog.js').LoadedSkill> {
  // Workspace skills use absolute paths, but createLocalSkillProxy resolves
  // relative to package root. Instead, build the loader inline for absolute paths.
  return async () => {
    const { readFile } = await import('node:fs/promises');

    let content: string;
    try {
      content = await readFile(absolutePath, 'utf-8');
    } catch (err) {
      throw new Error(
        `Failed to load workspace SKILL.md at ${absolutePath}: ${err instanceof Error ? err.message : String(err)}`
      );
    }

    // Use the lightweight built-in parser from catalog.ts via re-parse
    const parsed = parseSkillFrontmatter(content);
    const body = content.replace(/^---\r?\n[\s\S]*?\r?\n---\r?\n?/, '').trim();

    const name = parsed?.name ?? path.basename(path.dirname(absolutePath));
    const description =
      parsed?.description ??
      body.split('\n').find((l) => l.trim() && !l.startsWith('#'))?.trim() ??
      '';

    return {
      name,
      displayName,
      description,
      content: body,
      frontmatter: (parsed ?? {}) as Record<string, unknown>,
      sourcePath: absolutePath,
    };
  };
}

/**
 * Convert parsed frontmatter + filesystem path into a SkillCatalogEntry.
 */
function frontmatterToEntry(
  fm: SkillFrontmatter,
  skillPath: string,
  absoluteSkillMdPath: string,
): SkillCatalogEntry {
  const displayName = fm.name
    .split('-')
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(' ');
  return {
    name: fm.name,
    displayName,
    description: fm.description ?? '',
    category: fm.category ?? 'workspace',
    tags: fm.tags ?? [],
    requiredSecrets: fm.requires_secrets ?? [],
    requiredTools: fm.requires_tools ?? [],
    skillPath,
    source: 'community' as const,
    namespace: 'wunderland',
    available: true,
    loadSkill: createAbsoluteSkillLoader(absoluteSkillMdPath, displayName),
  };
}

/**
 * Discover SKILL.md files from a workspace directory.
 *
 * Scans `<skillsDir>/` for sub-directories containing a SKILL.md file,
 * parses the YAML frontmatter, and returns the discovered skills as
 * SkillCatalogEntry[] compatible with the existing catalog.
 *
 * If the directory does not exist, returns an empty array.
 *
 * @example
 * ```ts
 * import { discoverWorkspaceSkills } from '@framers/agentos-skills-registry';
 *
 * // Uses default .agents/skills/ in cwd
 * const skills = await discoverWorkspaceSkills();
 *
 * // Custom path
 * const skills2 = await discoverWorkspaceSkills({
 *   skillsDir: '/my/project/.agents/skills',
 * });
 * ```
 */
export async function discoverWorkspaceSkills(
  options?: WorkspaceDiscoveryOptions,
): Promise<SkillCatalogEntry[]> {
  const cwd = options?.cwd ?? process.cwd();
  const skillsDir = options?.skillsDir
    ? path.resolve(cwd, options.skillsDir)
    : path.resolve(cwd, '.agents', 'skills');

  // If directory doesn't exist, return empty array
  let entries: string[];
  try {
    entries = await fs.readdir(skillsDir);
  } catch {
    return [];
  }

  const discovered: SkillCatalogEntry[] = [];

  for (const entry of entries) {
    const entryPath = path.join(skillsDir, entry);

    // Only scan directories
    let stat;
    try {
      stat = await fs.stat(entryPath);
    } catch {
      continue;
    }
    if (!stat.isDirectory()) continue;

    // Look for SKILL.md inside the directory
    const skillMdPath = path.join(entryPath, 'SKILL.md');
    let content: string;
    try {
      content = await fs.readFile(skillMdPath, 'utf-8');
    } catch {
      continue;
    }

    const frontmatter = parseSkillFrontmatter(content);
    if (!frontmatter) continue;

    // Use relative path from skillsDir for the skillPath
    const relativePath = path.relative(skillsDir, skillMdPath);
    discovered.push(frontmatterToEntry(frontmatter, relativePath, skillMdPath));
  }

  return discovered;
}

/**
 * Merge workspace-discovered skills with the registry catalog.
 *
 * Workspace skills take priority: if a workspace skill has the same `name`
 * as a registry skill, the workspace version replaces the registry one.
 *
 * @param registrySkills  - Skills from the built-in catalog (SKILLS_CATALOG)
 * @param workspaceSkills - Skills discovered from the workspace directory
 * @returns Merged array with workspace overrides applied
 */
export function mergeWithWorkspaceSkills(
  registrySkills: SkillCatalogEntry[],
  workspaceSkills: SkillCatalogEntry[],
): SkillCatalogEntry[] {
  if (workspaceSkills.length === 0) return registrySkills;

  const workspaceNames = new Set(workspaceSkills.map((s) => s.name));

  // Filter out registry skills that are overridden by workspace skills
  const filtered = registrySkills.filter((s) => !workspaceNames.has(s.name));

  // Workspace skills come first (higher priority), then remaining registry skills
  return [...workspaceSkills, ...filtered];
}
