import { createOpenAICompatible } from "@ai-sdk/openai-compatible";
import { generateText } from "ai";
import TurndownService from "turndown";
import { fetchBodyHtml } from "../../browser/index.js";

const turndown = new TurndownService();

function createModel() {
  const lmstudio = createOpenAICompatible({
    name: "deepseek-v4-flash",
    baseURL: process.env.DEEPSEEK_BASE_URL || "https://api.deepseek.com",
    apiKey: process.env.DEEPSEEK_API_KEY,
  });
  return lmstudio("deepseek-v4-flash");
}

export async function extractInformation(url, informationToExtract) {
  const html = await fetchBodyHtml(url);
  const rawMarkdown = turndown.turndown(html);

  const { text } = await generateText({
    model: createModel(),
    system: `You extract specific information from Markdown that was mechanically converted from a web page. Extract only this: ${informationToExtract}. Ignore navigation, ads, cookie banners, and unrelated content. Return the extracted information as Markdown, preserving structure like lists, tables, and links where relevant. Return only the extracted information, with no commentary. If the page doesn't contain this information, return "Not found."`,
    prompt: rawMarkdown,
  });

  return text;
}
