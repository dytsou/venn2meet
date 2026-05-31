import { describe, expect, it } from "vitest";
import { classifyHeatmapCell } from "../public/js/encoding.js";

describe("encoding", () => {
  it("marks only-missing-me when count is n-1 and viewer did not select", () => {
    expect(
      classifyHeatmapCell({
        n: 3,
        count: 2,
        mine: false
      })
    ).toEqual({
      perfect: false,
      nearPerfect: false,
      onlyMissingMe: true,
      myTime: false
    });
  });

  it("marks perfect when count equals n and viewer selected", () => {
    expect(
      classifyHeatmapCell({
        n: 4,
        count: 4,
        mine: true
      })
    ).toEqual({
      perfect: true,
      nearPerfect: false,
      onlyMissingMe: false,
      myTime: true
    });
  });

  it("distinguishes near-perfect from only-missing-me for n-1 counts", () => {
    expect(
      classifyHeatmapCell({
        n: 4,
        count: 3,
        mine: true
      })
    ).toMatchObject({
      nearPerfect: true,
      onlyMissingMe: false,
      myTime: true
    });

    expect(
      classifyHeatmapCell({
        n: 4,
        count: 3,
        mine: false
      })
    ).toMatchObject({
      nearPerfect: false,
      onlyMissingMe: true,
      myTime: false
    });
  });

  it("returns no heatmap highlights when n is zero", () => {
    expect(
      classifyHeatmapCell({
        n: 0,
        count: 0,
        mine: false
      })
    ).toEqual({
      perfect: false,
      nearPerfect: false,
      onlyMissingMe: false,
      myTime: false
    });
  });

  it("does not mark only-missing-me when n is one", () => {
    expect(
      classifyHeatmapCell({
        n: 1,
        count: 0,
        mine: false
      })
    ).toEqual({
      perfect: false,
      nearPerfect: false,
      onlyMissingMe: false,
      myTime: false
    });
  });

  it("does not mark near-perfect when n is one", () => {
    expect(
      classifyHeatmapCell({
        n: 1,
        count: 0,
        mine: true
      })
    ).toEqual({
      perfect: false,
      nearPerfect: false,
      onlyMissingMe: false,
      myTime: true
    });
  });

  it("does not mark near-perfect when n is one and mine true", () => {
    expect(
      classifyHeatmapCell({
        n: 1,
        count: 0,
        mine: true
      })
    ).toMatchObject({
      nearPerfect: false,
      myTime: true
    });
  });
});
