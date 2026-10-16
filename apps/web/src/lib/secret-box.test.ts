import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

describe("secret-box", () => {
  beforeEach(() => {
    vi.resetModules();
    process.env.SETTINGS_KEY = "test-key-1";
  });

  it("round-trips and never stores the plain text", async () => {
    const { seal, open } = await import("./secret-box");
    const s = seal("p@ss word $#");
    expect(s).not.toContain("p@ss");
    expect(s.startsWith("v1:")).toBe(true);
    expect(open(s)).toBe("p@ss word $#");
    expect(seal("x")).not.toBe(seal("x"));
  });

  it("returns null with another key or a tampered value", async () => {
    const { seal, open } = await import("./secret-box");
    const s = seal("secret");
    process.env.SETTINGS_KEY = "test-key-2";
    expect(open(s)).toBeNull();
    process.env.SETTINGS_KEY = "test-key-1";
    const parts = s.split(":");
    expect(open([parts[0], parts[1], parts[2], "AAAA"].join(":"))).toBeNull();
    expect(open("garbage")).toBeNull();
  });
});
