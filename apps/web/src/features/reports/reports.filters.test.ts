import { describe, expect, it } from "vitest";
import { activeFilterCount, filterQuery, filterWhere, parseFilter } from "./reports.filters";

describe("report filters", () => {
  it("parses and validates search params", () => {
    const f = parseFilter({ company: "c1", sector: "s1", status: "open", category: "C3", from: "2026-10-01", to: "bad", x: "y" });
    expect(f).toEqual({ company: "c1", sector: "s1", status: "open", category: "C3", from: "2026-10-01" });
    expect(parseFilter({ status: "draft", category: "C9" })).toEqual({});
    expect(activeFilterCount(f)).toBe(5);
  });

  it("round-trips through the query string (same filter for screen and Excel)", () => {
    const f = parseFilter({ contract: "k1", central: "ce1", project: "p1" });
    expect(parseFilter(Object.fromEntries(new URLSearchParams(filterQuery(f))))).toEqual(f);
  });

  it("builds a where that always excludes drafts and narrows by org level", () => {
    const w = filterWhere({ generalDept: "g1", status: "open" });
    expect(w.AND).toEqual([
      { status: { not: "draft" } },
      { ao: { project: { central: { dept: { generalDeptId: "g1" } } } } },
      { status: { in: ["active", "returned", "on_hold"] } },
    ]);
  });
});
