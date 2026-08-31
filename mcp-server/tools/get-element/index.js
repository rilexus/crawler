import { z } from "zod";
import { getElementBySelector } from "../../../browser/index.js";

export const name = "get-element";

export const config = {
  title: "Get element by CSS selector",
  description:
    "Open a URL in a headless browser and return the outer HTML of the first element matching a CSS selector.",
  inputSchema: {
    url: z.string().url().describe("The URL of the website."),
    selector: z.string().describe("The CSS selector to query for."),
  },
};

export async function handler({ url, selector }) {
  const html = await getElementBySelector(url, selector);

  return {
    content: [
      {
        type: "text",
        text: html ?? `No element found matching selector: ${selector}`,
      },
    ],
  };
}
