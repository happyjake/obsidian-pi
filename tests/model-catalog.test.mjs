import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import {
  getEffectiveConfig,
  normalizeReasoningLevels,
  parseModelCatalog,
  parseTokenAmount,
  writePiEnabledModels
} from "../src/pi/model-catalog.mjs";

describe("Pi model catalog helpers", () => {
  const originalPiAgentDir = process.env.PI_CODING_AGENT_DIR;
  const tmpDirs = [];

  afterEach(() => {
    if (originalPiAgentDir === undefined) delete process.env.PI_CODING_AGENT_DIR;
    else process.env.PI_CODING_AGENT_DIR = originalPiAgentDir;
    for (const dir of tmpDirs.splice(0)) fs.rmSync(dir, { recursive: true, force: true });
  });

  it("parses compact token amounts", () => {
    expect(parseTokenAmount("128K")).toBe(128_000);
    expect(parseTokenAmount("1.5M")).toBe(1_500_000);
    expect(parseTokenAmount("bad")).toBe(0);
  });

  it("normalizes reasoning levels", () => {
    expect(normalizeReasoningLevels("no")).toEqual(["off"]);
    expect(normalizeReasoningLevels("yes")).toEqual([
      "off",
      "minimal",
      "low",
      "medium",
      "high",
      "xhigh"
    ]);
    expect(normalizeReasoningLevels("low/high/custom")).toEqual(["low", "high"]);
  });

  it("parses Pi --list-models table output", () => {
    const output = `provider  model  context  output  thinking\nopenai  gpt-5  128K  16K  low/medium/high`;

    expect(parseModelCatalog(output)).toEqual([
      {
        slug: "openai/gpt-5",
        displayName: "openai: gpt-5",
        contextWindow: 128_000,
        maxOutputTokens: 16_000,
        defaultReasoningLevel: "medium",
        supportedReasoningLevels: ["low", "medium", "high"]
      }
    ]);
  });

  it("reads effective Pi config from global and project settings", () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), "pi-agent-test-"));
    const vaultDir = fs.mkdtempSync(path.join(os.tmpdir(), "pi-agent-vault-"));
    tmpDirs.push(dir, vaultDir);
    process.env.PI_CODING_AGENT_DIR = path.join(dir, "agent");
    fs.mkdirSync(process.env.PI_CODING_AGENT_DIR, { recursive: true });
    fs.writeFileSync(
      path.join(process.env.PI_CODING_AGENT_DIR, "settings.json"),
      JSON.stringify({
        defaultProvider: "openai",
        defaultModel: "gpt-5.1",
        defaultThinkingLevel: "high",
        enabledModels: ["openai/gpt-5.1"]
      })
    );
    fs.mkdirSync(path.join(vaultDir, ".pi"), { recursive: true });
    fs.writeFileSync(
      path.join(vaultDir, ".pi", "settings.json"),
      JSON.stringify({ enabledModels: ["anthropic/claude-sonnet-4.5"] })
    );

    expect(getEffectiveConfig(vaultDir)).toEqual({
      effectiveModel: "openai/gpt-5.1",
      effectiveReasoning: "high",
      scopedModels: ["anthropic/claude-sonnet-4.5"]
    });
  });

  it("writes Pi enabled models to settings", () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), "pi-agent-test-"));
    tmpDirs.push(dir);
    const settingsPath = path.join(dir, "settings.json");
    fs.writeFileSync(
      settingsPath,
      JSON.stringify({
        defaultProvider: "openai",
        "scoped-models": ["legacy/model"]
      })
    );

    expect(writePiEnabledModels([" openai/gpt-5.1 ", "", "openai/gpt-5.1"], settingsPath)).toEqual([
      "openai/gpt-5.1"
    ]);
    expect(JSON.parse(fs.readFileSync(settingsPath, "utf8"))).toEqual({
      defaultProvider: "openai",
      enabledModels: ["openai/gpt-5.1"]
    });

    expect(writePiEnabledModels([], settingsPath)).toEqual([]);
    expect(JSON.parse(fs.readFileSync(settingsPath, "utf8"))).toEqual({
      defaultProvider: "openai"
    });
  });
});
