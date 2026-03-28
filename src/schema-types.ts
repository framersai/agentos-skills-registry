/**
 * @fileoverview Type declarations for the registry.json schema.
 *
 * These types describe the shape of `@framers/agentos-skills/registry.json` —
 * the machine-readable index of all bundled SKILL.md files. The canonical
 * type declarations also exist in `@framers/agentos-skills/types.d.ts`.
 *
 * These types differ from `SkillCatalogEntry` in `catalog.ts`, which is a
 * higher-level, UI-friendly representation with lazy-loading factories.
 *
 * @module @framers/agentos-skills-registry/schema-types
 */

export type SkillInstallKind = 'brew' | 'apt' | 'node' | 'go' | 'uv' | 'download';

export interface SkillInstallSpec {
  id?: string;
  kind: SkillInstallKind;
  label?: string;
  bins?: string[];
  os?: readonly string[];
  formula?: string;
  package?: string;
  module?: string;
  url?: string;
  archive?: string;
  extract?: boolean;
  stripComponents?: number;
  targetDir?: string;
}

export interface SkillRequirements {
  bins?: string[];
  anyBins?: string[];
  env?: string[];
  config?: string[];
}

export interface SkillMetadata {
  always?: boolean;
  skillKey?: string;
  primaryEnv?: string;
  emoji?: string;
  homepage?: string;
  os?: readonly string[];
  requires?: SkillRequirements;
  install?: SkillInstallSpec[];
}

/** Shape of a single skill entry in registry.json */
export interface SkillRegistryEntry {
  id: string;
  name: string;
  displayName?: string;
  version: string;
  path: string;
  description: string;
  category?: string;
  namespace?: string;
  verified: boolean;
  source?: 'curated' | 'community';
  verifiedAt?: string;
  keywords?: string[];
  requiredSecrets?: string[];
  requiredTools?: string[];
  metadata?: SkillMetadata;
}

export interface SkillsRegistryStats {
  totalSkills: number;
  curatedCount: number;
  communityCount: number;
}

/** Shape of the full registry.json file */
export interface SkillsRegistry {
  version: string;
  updated: string;
  categories: {
    curated: string[];
    community: string[];
  };
  skills: {
    curated: SkillRegistryEntry[];
    community: SkillRegistryEntry[];
  };
  stats: SkillsRegistryStats;
}
