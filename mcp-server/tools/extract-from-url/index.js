import { z } from "zod";
import { extractInformation } from "../../../agents/extract-information/index.js";

export const name = "extract-information-from-website";

export const config = {
  title: "Extract information from website",
  description:
    "Open a URL in a headless browser and extract the requested information from the rendered page.",
  inputSchema: {
    information: z
      .string()
      .describe("Information to extract from the website."),
    url: z.string().url().describe("The URL to open."),
  },
};

export async function handler({ url, information }) {
  try {
    const infoAsMarkdown = await extractInformation(url, information);
    return {
      content: [{ type: "text", text: infoAsMarkdown }],
    };
  } catch (err) {
    console.error("Error extracting information from URL:", err);
    return {
      content: [{ type: "text", text: `Failed to extract information: ${err.message}` }],
      isError: true,
    };
  }
}
