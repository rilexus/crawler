import { z } from "zod";
import { set, get } from "../../store/index.js";

export const name = "save-value";

export const config = {
  title: "Save value",
  description:
    "Save a value to extract from a URL: a short description of what it represents, plus up to 3 candidate CSS selectors to locate it.",
  inputSchema: {
    url: z.string().url().describe("The URL of the website."),
    description: z
      .string()
      .describe("A short description of what this value represents."),
    selectors: z
      .array(z.string())
      .min(1)
      .max(3)
      .describe("Up to 3 candidate CSS selectors to locate this value."),
  },
};

export async function handler({ url, description, selectors }) {
  const site = await get(url);
  const values = site?.values ?? [];

  await set(url, {
    url,
    values: [...values, { description, selectors, value: null }],
  });

  return {
    content: [
      {
        type: "text",
        text: `Value saved: ${JSON.stringify(await get(url))}`,
      },
    ],
  };
}
