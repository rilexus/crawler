import { z } from "zod";
import { generateMarkdown } from "../../../agents/website-to-markdown/index.js";

export const name = "website-to-markdown";

export const config = {
  title: "Website to Markdown",
  description:
    "Open a URL in a headless browser and convert the rendered page to Markdown.",
  inputSchema: {
    url: z.string().url().describe("The URL to open."),
  },
};

export async function handler({ url }, extra) {
  const apiKey = extra?.requestInfo?.headers?.authorization?.replace(
    /^Bearer\s+/i,
    "",
  );
  const text = await generateMarkdown(url, apiKey);
  return {
    content: [{ type: "text", text }],
  };
}
