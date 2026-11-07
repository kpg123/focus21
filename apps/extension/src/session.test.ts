import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  claimPlayback,
  pauseIfActive,
  clearIfTab,
  heartbeatSeconds,
  mediaKey,
  type ActiveWatch,
} from "./session.ts";
import type { WatchContext } from "./platforms.ts";

const videoA: WatchContext = {
  platform: "youtube",
  channelId: "chan-a",
  channelName: "Channel A",
  videoId: "vid-a",
  videoTitle: "Video A",
  url: "https://www.youtube.com/watch?v=vid-a",
};

const videoB: WatchContext = {
  platform: "youtube",
  channelId: "chan-b",
  channelName: "Channel B",
  videoId: "vid-b",
  videoTitle: "Video B",
  url: "https://www.youtube.com/watch?v=vid-b",
};

describe("single-session claims", () => {
  it("creates a new session on first play", () => {
    const next = claimPlayback(null, 1, videoA, 1000);
    assert.equal(next.playing, true);
    assert.equal(next.tabId, 1);
    assert.equal(next.mediaKey, mediaKey(videoA));
    assert.ok(next.clientSessionId.startsWith("cs_"));
  });

  it("resumes the same session when the same tab replays the same video", () => {
    const first = claimPlayback(null, 1, videoA, 1000);
    const resumed = claimPlayback(first, 1, videoA, 5000);
    assert.equal(resumed.clientSessionId, first.clientSessionId);
    assert.equal(resumed.playing, true);
  });

  it("starts a new session when another video starts playing (last play wins)", () => {
    const first = claimPlayback(null, 1, videoA, 1000);
    const next = claimPlayback(first, 2, videoB, 2000);
    assert.notEqual(next.clientSessionId, first.clientSessionId);
    assert.equal(next.tabId, 2);
    assert.equal(next.mediaKey, mediaKey(videoB));
    assert.equal(next.playing, true);
  });

  it("replaces the active session when a second tab plays a different video", () => {
    let active: ActiveWatch | null = claimPlayback(null, 1, videoA, 1000);
    active = claimPlayback(active, 3, videoB, 1500);
    assert.equal(active.tabId, 3);
    assert.equal(active.mediaKey, mediaKey(videoB));
  });

  it("pauses only the active tab and clears on tab close", () => {
    const active = claimPlayback(null, 1, videoA, 1000);
    const paused = pauseIfActive(active, 1);
    assert.equal(paused?.playing, false);
    assert.equal(pauseIfActive(active, 99)?.playing, true);
    assert.equal(clearIfTab(active, 1), null);
    assert.equal(clearIfTab(active, 2)?.tabId, 1);
  });

  it("credits heartbeat seconds only while playing", () => {
    const playing = claimPlayback(null, 1, videoA, 0);
    assert.equal(heartbeatSeconds(playing, 15_000), 15);
    const paused = pauseIfActive(playing, 1)!;
    assert.equal(heartbeatSeconds(paused, 30_000), 0);
  });
});
