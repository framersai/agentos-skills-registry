import fs from 'node:fs';
import { describe, expect, it } from 'vitest';

const packageJson = JSON.parse(
  fs.readFileSync(new URL('../package.json', import.meta.url), 'utf8')
) as {
  exports: Record<string, string | { import?: string; default?: string }>;
};

describe('@framers/agentos-skills-registry package exports', () => {
  it('defines a default target for each JS export entry', () => {
    for (const [subpath, entry] of Object.entries(packageJson.exports)) {
      if (subpath === './package.json' || typeof entry === 'string') {
        continue;
      }

      expect(entry.default, `${subpath} is missing a default export target`).toBe(entry.import);
    }
  });
});
