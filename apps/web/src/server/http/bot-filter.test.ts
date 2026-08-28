import { describe, expect, it } from "vitest";

import { isBot } from "./bot-filter";

describe("isBot", () => {
  it("lets real browsers through", () => {
    for (const ua of [
      "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0 Safari/537.36",
      "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 Version/17.0 Mobile Safari/604.1",
      "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) Gecko/20100101 Firefox/121.0",
    ]) {
      expect(isBot(ua)).toBe(false);
    }
  });

  it("catches crawlers, previewers and scripted clients", () => {
    for (const ua of [
      "Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)",
      "Mozilla/5.0 (compatible; bingbot/2.0)",
      "facebookexternalhit/1.1",
      "Slackbot-LinkExpanding 1.0",
      "curl/8.4.0",
      "python-requests/2.31.0",
      "Mozilla/5.0 HeadlessChrome/120.0.0.0",
      "Go-http-client/1.1",
    ]) {
      expect(isBot(ua)).toBe(true);
    }
  });

  it("treats a missing user agent as automated", () => {
    expect(isBot(null)).toBe(true);
    expect(isBot("")).toBe(true);
  });
});
