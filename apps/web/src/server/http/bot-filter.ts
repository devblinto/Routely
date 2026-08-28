import "server-only";

/**
 * Crawler detection for the public ingestion endpoints.
 *
 * Bots load pages, and a page a crawler visited is not a page a person saw. Counting them
 * would inflate one arm of an experiment for reasons unrelated to the change being tested —
 * and because crawl rates differ between URLs, the inflation is not even symmetric.
 *
 * User-agent matching is a blunt instrument: it misses anything that lies, and it is nothing
 * like bot detection. It is here because the overwhelming majority of automated traffic
 * identifies itself honestly, and filtering that costs one regular expression.
 */

const BOT_PATTERN =
  /bot|crawl|spider|slurp|bingpreview|facebookexternalhit|embedly|quora link preview|pinterest|vkshare|w3c_validator|whatsapp|telegram|discordbot|slackbot|linkedinbot|headlesschrome|phantomjs|puppeteer|playwright|lighthouse|gtmetrix|pingdom|uptimerobot|monitoring|curl\/|wget\/|python-requests|axios\/|go-http-client|java\/|okhttp/i;

export function isBot(userAgent: string | null): boolean {
  if (!userAgent) {
    // A browser always sends one. Its absence means a script, which is not a visitor.
    return true;
  }
  return BOT_PATTERN.test(userAgent);
}
