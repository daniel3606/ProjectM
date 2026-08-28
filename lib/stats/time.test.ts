/** @jest-environment node */

import {
  bucketsFor,
  formatHourWindow,
  periodCaption,
  resolvePeriod,
  startOfWeek,
} from "@/lib/stats/time";

/** Local-time timestamp, so assertions match the local-time bucketing. */
function at(year: number, month: number, day: number, hour = 0): number {
  return new Date(year, month - 1, day, hour, 0, 0, 0).getTime();
}

// 2024-01-03 is a Wednesday.
const WEDNESDAY = at(2024, 1, 3, 14);

describe("resolvePeriod", () => {
  it("scopes today to the calendar day and compares against yesterday", () => {
    const range = resolvePeriod("today", WEDNESDAY);

    expect(range.start).toBe(at(2024, 1, 3));
    expect(range.end).toBe(at(2024, 1, 4));
    expect(range.previousStart).toBe(at(2024, 1, 2));
    expect(range.previousEnd).toBe(at(2024, 1, 3));
    expect(range.dayCount).toBe(1);
  });

  it("starts the week on Monday and compares against the previous seven days", () => {
    const range = resolvePeriod("week", WEDNESDAY);

    expect(range.start).toBe(at(2024, 1, 1));
    expect(range.end).toBe(at(2024, 1, 8));
    expect(range.previousStart).toBe(at(2023, 12, 25));
    expect(range.previousEnd).toBe(at(2024, 1, 1));
    expect(range.dayCount).toBe(7);
  });

  it("treats a Sunday as the end of its week, not the start of a new one", () => {
    expect(startOfWeek(at(2024, 1, 7, 23))).toBe(at(2024, 1, 1));
  });

  it("marks month and year as premium, today and week as free", () => {
    expect(resolvePeriod("today", WEDNESDAY).requiresPremium).toBe(false);
    expect(resolvePeriod("week", WEDNESDAY).requiresPremium).toBe(false);
    expect(resolvePeriod("month", WEDNESDAY).requiresPremium).toBe(true);
    expect(resolvePeriod("year", WEDNESDAY).requiresPremium).toBe(true);
  });
});

describe("bucketsFor", () => {
  it("labels every column of a week Mon through Sun", () => {
    const buckets = bucketsFor(resolvePeriod("week", WEDNESDAY));

    expect(buckets).toHaveLength(7);
    expect(buckets.map((b) => b.label)).toEqual([
      "Mon",
      "Tue",
      "Wed",
      "Thu",
      "Fri",
      "Sat",
      "Sun",
    ]);
  });

  it("thins the labels on a month so the axis stays readable", () => {
    const buckets = bucketsFor(resolvePeriod("month", WEDNESDAY));

    expect(buckets).toHaveLength(31);
    expect(buckets.filter((b) => b.label !== "").length).toBeLessThan(7);
  });

  it("splits today into three-hour columns", () => {
    const buckets = bucketsFor(resolvePeriod("today", WEDNESDAY));

    expect(buckets).toHaveLength(8);
    expect(buckets[0].label).toBe("12a");
  });

  it("gives a year one bucket per month", () => {
    expect(bucketsFor(resolvePeriod("year", WEDNESDAY))).toHaveLength(12);
  });
});

describe("formatHourWindow", () => {
  it("reads as a plain clock window", () => {
    expect(formatHourWindow(9, 11)).toBe("9 AM – 11 AM");
    expect(formatHourWindow(22, 24)).toBe("10 PM – 12 AM");
    expect(formatHourWindow(0, 2)).toBe("12 AM – 2 AM");
  });
});

describe("periodCaption", () => {
  it("reads naturally in body copy", () => {
    expect(periodCaption("today")).toBe("Today");
    expect(periodCaption("week")).toBe("This week");
    expect(periodCaption("year")).toBe("This year");
  });
});
