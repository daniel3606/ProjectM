import { scheduledBlockIsHard, scheduledBlockMode } from "@/lib/timedBlockPremium";

describe("Premium settings on a scheduled block", () => {
  it("runs Deep Focus as Hard Block only while Premium is active", () => {
    expect(scheduledBlockIsHard({ focusMode: "deep" }, true)).toBe(true);
    expect(scheduledBlockIsHard({ focusMode: "deep" }, false)).toBe(false);
    expect(scheduledBlockIsHard({ focusMode: "flexible" }, true)).toBe(false);
  });

  it("applies Allow Only only while Premium is active", () => {
    expect(scheduledBlockMode({ blockMode: "allowOnly" }, true)).toBe("allowOnly");
    expect(scheduledBlockMode({ blockMode: "allowOnly" }, false)).toBe("block");
    expect(scheduledBlockMode({}, true)).toBe("block");
  });
});
