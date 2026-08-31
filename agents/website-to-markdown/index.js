import { createOpenAICompatible } from "@ai-sdk/openai-compatible";
import { generateText } from "ai";
import puppeteer from "puppeteer";
import TurndownService from "turndown";

const turndown = new TurndownService();

// Points at LM Studio's local server (Developer > Start Server in LM Studio).
// LM Studio doesn't check the API key, so any placeholder value works.
function createModel(apiKey) {
  const lmstudio = createOpenAICompatible({
    name: "lmstudio",
    baseURL: process.env.LM_STUDIO_BASE_URL ?? "http://127.0.0.1:1234/v1",
    apiKey: apiKey,
  });
  return lmstudio(process.env.LM_STUDIO_MODEL ?? "qwen3.5-4b");
}

async function fetchBodyHtml(url) {
  const args = process.env.PUPPETEER_EXECUTABLE_PATH
    ? ["--no-sandbox", "--disable-setuid-sandbox"]
    : [];
  const browser = await puppeteer.launch({ headless: true, args });
  try {
    const page = await browser.newPage();
    await page.goto(url, { waitUntil: "networkidle0" });
    return await page.evaluate(() => {
      document
        .querySelectorAll("script, style, noscript, svg, meta, link, template")
        .forEach((el) => el.remove());
      return document.body.innerHTML;
    });
  } finally {
    await browser.close();
  }
}

export async function generate(url, apiKey) {
  const html = await fetchBodyHtml(url);
  const rawMarkdown = turndown.turndown(html);
  const { text } = await generateText({
    model: createModel(apiKey),
    system:
      "You clean up Markdown that was mechanically converted from a web page. Remove leftover navigation, ads, cookie banners, and duplicate links. Fix broken formatting and heading structure. Keep the actual content: headings, lists, links, and code blocks. Return only the cleaned Markdown, with no commentary.",
    prompt: rawMarkdown,
  });
  return text;
}
