import { z } from "zod";
import { getBody } from "../../../browser/index.js";

export const name = "fetch";

export const config = {
  title: "Fetch raw HTML",
  description:
    "Open a URL in a headless browser and return the rendered page's raw HTML body.",
  inputSchema: {
    url: z.string().url().describe("The URL of the website."),
  },
};

export async function handler({ url }) {
  const html = await getBody(url);

  return {
    content: [
      {
        type: "text",
        text: `
        \`\`\`html
          ${html}
        \`\`\`
        `,
      },
    ],
  };
}
