import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  extractFromInitialData,
  extractFromPlayerResponse,
  looksLikeChannelName,
  mergeChannelInfo,
  parseChannelHref,
} from "./youtube.ts";

describe("YouTube channel parsing helpers", () => {
  it("rejects category • year metadata as channel names", () => {
    assert.equal(looksLikeChannelName("Comedy • 2012"), false);
    assert.equal(looksLikeChannelName("Gaming · 2020"), false);
    assert.equal(looksLikeChannelName("hatless spider"), true);
    assert.equal(looksLikeChannelName("Unknown channel"), false);
  });

  it("parses channel and handle hrefs", () => {
    assert.deepEqual(parseChannelHref("/channel/UCabcdef123"), {
      channelId: "UCabcdef123",
    });
    assert.deepEqual(parseChannelHref("/@Poofesure"), { handle: "Poofesure" });
    assert.deepEqual(parseChannelHref("/user/MarkFeltonProductions"), {
      handle: "MarkFeltonProductions",
    });
  });

  it("extracts author + channelId from player response", () => {
    const info = extractFromPlayerResponse({
      videoDetails: {
        videoId: "ax-I_rhu_ss",
        title: "I Formed Macedonia the Worst Way Possible",
        channelId: "UCxxxxxxxxxxxxxxxxxxxx",
        author: "hatless spider",
        isLive: false,
      },
    });
    assert.equal(info?.videoId, "ax-I_rhu_ss");
    assert.equal(info?.channel?.channelId, "UCxxxxxxxxxxxxxxxxxxxx");
    assert.equal(info?.channel?.channelName, "hatless spider");
  });

  it("extracts owner renderer from initial data", () => {
    const info = extractFromInitialData({
      contents: {
        twoColumnWatchNextResults: {
          results: {
            results: {
              contents: [
                {
                  videoSecondaryInfoRenderer: {
                    owner: {
                      videoOwnerRenderer: {
                        title: {
                          runs: [
                            {
                              text: "iSorrowproductions",
                              navigationEndpoint: {
                                browseEndpoint: {
                                  browseId: "UCsorrow123",
                                  canonicalBaseUrl: "/@iSorrowproductions",
                                },
                                commandMetadata: {
                                  webCommandMetadata: {
                                    url: "/@iSorrowproductions",
                                  },
                                },
                              },
                            },
                          ],
                        },
                      },
                    },
                  },
                },
              ],
            },
          },
        },
      },
    });
    assert.equal(info?.channelId, "UCsorrow123");
    assert.equal(info?.channelName, "iSorrowproductions");
    assert.equal(info?.handle, "iSorrowproductions");
  });

  it("merges partial channel facts without losing either id or name", () => {
    const merged = mergeChannelInfo(
      { channelId: "UCabc", channelName: "Unknown channel" },
      { channelId: "unknown", channelName: "Comedy • 2012", handle: "Poofesure" },
      { channelName: "Poofesure", handle: "Poofesure" },
    );
    assert.equal(merged?.channelId, "UCabc");
    assert.equal(merged?.channelName, "Poofesure");
    assert.equal(merged?.handle, "Poofesure");
  });
});
