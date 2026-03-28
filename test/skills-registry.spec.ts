import { afterEach, describe, it, expect, vi } from 'vitest';
import { createRequire } from 'node:module';

import { SKILLS_CATALOG, loadSkillByName, searchSkills } from '../src/catalog';
import { createCuratedSkillRegistry, createCuratedSkillSnapshot } from '../src/index';

// registry.json now lives in the @framers/agentos-skills content package
const require = createRequire(import.meta.url);
let registry: { skills: { curated: unknown[] } };
try {
  registry = require('@framers/agentos-skills/registry.json');
} catch {
  // Monorepo fallback: sibling directory
  registry = require('../../agentos-skills/registry.json');
}

describe('@framers/agentos-skills-registry', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('SKILLS_CATALOG stays in sync with curated registry entries', () => {
    expect(SKILLS_CATALOG.length).toBe(registry.skills.curated.length);
  });

  it('searchSkills finds github', () => {
    const matches = searchSkills('github');
    expect(matches.length).toBeGreaterThan(0);
    expect(matches.some((m) => m.name === 'github')).toBe(true);
  });

  it('createCuratedSkillSnapshot builds a prompt', async () => {
    const snapshot = await createCuratedSkillSnapshot({ skills: ['github'], platform: process.platform });
    expect(snapshot.prompt).toContain('# Available Skills');
    expect(snapshot.prompt.toLowerCase()).toContain('github');
    expect(snapshot.skills.some((s) => s.name === 'github')).toBe(true);
  });

  it('createCuratedSkillRegistry supports loading only selected skills', async () => {
    const registry = await createCuratedSkillRegistry({ skills: ['github'] });
    const snapshot = registry.buildSnapshot({ platform: process.platform });

    expect(snapshot.skills.map((skill) => skill.name)).toEqual(['github']);
  });

  it('only loads the selected skills when a filtered snapshot is requested', async () => {
    const github = SKILLS_CATALOG.find((entry) => entry.name === 'github');
    const weather = SKILLS_CATALOG.find((entry) => entry.name === 'weather');

    expect(github).toBeTruthy();
    expect(weather).toBeTruthy();

    const githubSpy = vi.spyOn(github!, 'loadSkill');
    const weatherSpy = vi.spyOn(weather!, 'loadSkill');

    const snapshot = await createCuratedSkillSnapshot({
      skills: ['github'],
      platform: process.platform,
    });

    expect(snapshot.skills.map((skill) => skill.name)).toEqual(['github']);
    expect(githubSpy).toHaveBeenCalledTimes(1);
    expect(weatherSpy).not.toHaveBeenCalled();
  });

  it('createCuratedSkillRegistry supports an empty selection', async () => {
    const registry = await createCuratedSkillRegistry({ skills: 'none' });
    const snapshot = registry.buildSnapshot({ platform: process.platform });

    expect(snapshot.prompt).toBe('');
    expect(snapshot.skills).toEqual([]);
  });

  it('loadSkillByName returns typed metadata for curated skills', async () => {
    const skill = await loadSkillByName('github');

    expect(skill).not.toBeNull();
    expect(skill?.name).toBe('github');
    expect(skill?.frontmatter.name).toBe('github');
    expect(skill?.metadata?.primaryEnv).toBe('GITHUB_TOKEN');
    expect(skill?.metadata?.emoji).toBe('\u{1F419}');
    expect(skill?.metadata?.requires?.bins).toEqual(['gh']);
    expect(skill?.metadata?.install?.[0]?.kind).toBe('brew');
  });
});
