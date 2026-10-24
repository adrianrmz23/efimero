import { describe, expect, it } from "vitest";
import { kenBurns, sceneAt, totalDuration } from "@/lib/reelTimeline";
import { isFalQueueUrl } from "@/lib/falClient";
import { TRANSFORM_PRESETS, estimateCost, transformPrompt } from "@/lib/transformPresets";

describe("sceneAt", () => {
  const durations = [3, 3, 3];

  it("shows the first scene at the start without mixing", () => {
    expect(sceneAt(0, durations, .6)).toEqual({ index: 0, progress: 0, next: 1, mix: 0 });
  });

  it("crossfades into the next scene during the last fade seconds", () => {
    const frame = sceneAt(2.7, durations, .6);
    expect(frame.index).toBe(0);
    expect(frame.next).toBe(1);
    expect(frame.mix).toBeCloseTo(.5, 5);
  });

  it("never mixes past the last scene", () => {
    expect(sceneAt(9, durations, .6)).toMatchObject({ index: 2, next: null, mix: 0, progress: 1 });
  });

  it("adds up the total duration", () => {
    expect(totalDuration(durations)).toBe(9);
  });
});

describe("kenBurns", () => {
  it("zooms in smoothly and alternates the pan direction", () => {
    expect(kenBurns(0, 0).scale).toBe(1);
    expect(kenBurns(1, 0).scale).toBeCloseTo(1.12, 5);
    expect(Math.sign(kenBurns(1, 0).dx)).toBe(-Math.sign(kenBurns(1, 1).dx));
  });
});

describe("fal helpers", () => {
  it("only accepts fal queue URLs", () => {
    expect(isFalQueueUrl("https://queue.fal.run/fal-ai/kling-video/requests/abc/status")).toBe(true);
    expect(isFalQueueUrl("https://example.com/requests/abc")).toBe(false);
    expect(isFalQueueUrl("http://queue.fal.run/x")).toBe(false);
  });

  it("estimates the cost and builds the prompt from a preset", () => {
    expect(estimateCost(10, .112)).toBe(1.12);
    expect(transformPrompt(TRANSFORM_PRESETS[0], "")).toMatch(/marble panels/);
  });
});
