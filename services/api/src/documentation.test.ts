import { existsSync, readFileSync, readdirSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const projectRoot = resolve(import.meta.dirname, "..");
const docsRoot = resolve(projectRoot, "docs");

const requiredDocs = [
  "README.md",
  "PRODUCT-AND-SCOPE.md",
  "ARCHITECTURE.md",
  "CODEBASE-MAP.md",
  "DATA-AND-CONTRACTS.md",
  "LOCAL-DEVELOPMENT-AND-TESTING.md",
  "CONTRIBUTING.md",
  "SECURITY.md",
  "DEPLOYMENT.md",
  "DECISIONS.md",
  "ROADMAP.md",
  "HISTORY-AND-RESEARCH.md",
] as const;

describe("project handoff documentation", () => {
  it("keeps the root agent guide and complete documentation index", () => {
    const agentGuide = resolve(projectRoot, "agent.md");
    expect(existsSync(agentGuide)).toBe(true);
    expect(readFileSync(agentGuide, "utf8")).toContain("docs/README.md");

    for (const file of requiredDocs) {
      expect(existsSync(resolve(docsRoot, file))).toBe(true);
    }

    const index = readFileSync(resolve(docsRoot, "README.md"), "utf8");
    for (const file of requiredDocs.filter(file => file !== "README.md")) {
      expect(index).toContain(`](${file})`);
    }
  });

  it("does not allow credential-shaped strings in agent-facing documentation", () => {
    const credentialPattern = /(sk-[A-Za-z0-9_-]{16,}|e2b_[A-Za-z0-9]{16,}|mongodb\+srv:\/\/|api[_ -]?secret\s*[:=]\s*[A-Za-z0-9_-]{12,})/i;
    const documentedFiles = [
      resolve(projectRoot, "agent.md"),
      ...readdirSync(docsRoot, { recursive: true })
        .filter(file => file.endsWith(".md"))
        .map(file => resolve(docsRoot, file)),
    ];

    for (const file of documentedFiles) {
      expect(readFileSync(file, "utf8")).not.toMatch(credentialPattern);
    }
  });
});
