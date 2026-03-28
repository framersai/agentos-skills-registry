/**
 * Type declarations for @framers/agentos-skills-registry (Catalog SDK).
 *
 * For registry.json schema types, see `@framers/agentos-skills/types`.
 * This file re-exports the schema types for backward compatibility.
 *
 * @module @framers/agentos-skills-registry
 */

// Re-export schema types from the content package for backward compatibility
export type {
  SkillInstallKind,
  SkillInstallSpec,
  SkillRequirements,
  SkillMetadata,
  SkillRegistryEntry,
  SkillsRegistryStats,
  SkillsRegistry,
} from '@framers/agentos-skills/types';
