import { afterAll, describe, expect, test } from "bun:test";
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { ESLint } from "eslint";

const projectRequire = createRequire(import.meta.url);
const pluginEntry = projectRequire.resolve("@next/eslint-plugin-next");
const nextPlugin = projectRequire("@next/eslint-plugin-next") as ESLint.Plugin;
const { getRootDirs } = projectRequire(join(dirname(pluginEntry), "utils/get-root-dirs.js")) as {
  getRootDirs(context: { cwd: string; settings: { next?: { rootDir?: string | string[] } } }): string[];
};
const fixture = mkdtempSync(join(tmpdir(), "gcms-next-eslint-glob-"));
for (const page of ["admin/pages/index.js", "website/pages/about.js", "admin/nested/pages/hidden.js"]) {
  const file = join(fixture, "apps", page);
  mkdirSync(dirname(file), { recursive: true });
  writeFileSync(file, "export default function Page() { return null; }\n");
}
writeFileSync(join(fixture, "apps", "not-a-directory"), "fixture\n");
afterAll(() => rmSync(fixture, { recursive: true, force: true }));

function roots(rootDir?: string | string[]): string[] {
  return getRootDirs({ cwd: fixture, settings: { next: { rootDir } } })
    .map((directory) => resolve(directory)).sort();
}

describe("Next ESLint directory discovery without braces", () => {
  test("the lockfile excludes the vulnerable dependency chain", () => {
    const lock = readFileSync(new URL("../bun.lock", import.meta.url), "utf8");
    expect(/\["(?:braces|micromatch|fast-glob)@/.test(lock)).toBe(false);
  });

  test("root tooling and the API resolve the same Drizzle instance", () => {
    const apiRequire = createRequire(new URL("../apps/api/package.json", import.meta.url));
    expect(projectRequire.resolve("drizzle-orm")).toBe(apiRequire.resolve("drizzle-orm"));
  });

  test("relative repository settings find only the two configured apps", () => {
    const actual = getRootDirs({
      cwd: process.cwd(),
      settings: { next: { rootDir: ["apps/admin/", "apps/website/"] } },
    }).map((directory) => resolve(directory)).sort();
    expect(actual).toEqual([resolve("apps/admin"), resolve("apps/website")]);
  });

  test("literal roots include no nested directories", () => {
    expect(roots(join(fixture, "apps/admin/"))).toEqual([join(fixture, "apps/admin")]);
  });

  test("wildcard and brace patterns find both app roots", () => {
    const expected = [join(fixture, "apps/admin"), join(fixture, "apps/website")];
    expect(roots(join(fixture, "apps/*"))).toEqual(expected);
    expect(roots(join(fixture, "apps/{admin,website}"))).toEqual(expected);
  });

  test("array settings preserve both app roots", () => {
    expect(roots([join(fixture, "apps/admin/"), join(fixture, "apps/website/")]))
      .toEqual([join(fixture, "apps/admin"), join(fixture, "apps/website")]);
  });

  test("default, missing and file roots retain their behavior", () => {
    expect(roots()).toEqual([fixture]);
    expect(roots(join(fixture, "apps/missing"))).toEqual([]);
    expect(roots(join(fixture, "apps/not-a-directory"))).toEqual([]);
  });

  test("Windows separators are normalized by the actual Next consumer", () => {
    expect(roots(join(fixture, "apps/admin").replaceAll("/", "\\")))
      .toEqual([join(fixture, "apps/admin")]);
  });

  test("Next still detects internal HTML links in both apps", async () => {
    const eslint = new ESLint({
      cwd: fixture,
      overrideConfigFile: true,
      overrideConfig: [{
        files: ["**/*.jsx"],
        languageOptions: { parserOptions: { ecmaFeatures: { jsx: true } } },
        plugins: { "@next/next": nextPlugin },
        settings: { next: { rootDir: [join(fixture, "apps/admin/"), join(fixture, "apps/website/")] } },
        rules: { "@next/next/no-html-link-for-pages": "error" },
      }],
    });
    const [invalid] = await eslint.lintText(
      'const Page = () => <><a href="/">Home</a><a href="/about">About</a></>;',
      { filePath: join(fixture, "probe.jsx") },
    );
    expect(invalid?.errorCount).toBe(2);
    expect(invalid?.messages.map((message) => message.ruleId))
      .toEqual(["@next/next/no-html-link-for-pages", "@next/next/no-html-link-for-pages"]);

    const [valid] = await eslint.lintText(
      'const Page = () => <><Link href="/">Home</Link><a href="https://example.com">External</a><a href="/hidden">Outside roots</a></>;',
      { filePath: join(fixture, "probe.jsx") },
    );
    expect(valid?.errorCount).toBe(0);
    expect(valid?.warningCount).toBe(0);
  });
});
