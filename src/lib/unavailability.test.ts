import { describe, expect, it } from "vitest";
import { findBlock, type Unavailability } from "./unavailability";

const list: Unavailability[] = [
  { id: "1", user_id: "a", start_date: "2026-12-01", end_date: "2026-12-05", reason: "ferias", notes: null },
];
describe("findBlock", () => {
  it("blocks the first and last day inclusive", () => {
    expect(findBlock(list, "a", "2026-12-01")?.reason).toBe("ferias");
    expect(findBlock(list, "a", "2026-12-05")?.reason).toBe("ferias");
  });
  it("does not block the day after or another technician", () => {
    expect(findBlock(list, "a", "2026-12-06")).toBeUndefined();
    expect(findBlock(list, "b", "2026-12-03")).toBeUndefined();
  });
});
