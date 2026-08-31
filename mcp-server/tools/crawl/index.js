import { z } from "zod";
import { get, set } from "../../store/index.js";
import { resolveSelectorCandidates } from "../../../browser/index.js";

export const name = "crawl-website";

export const config = {
  title: "Crawl website",
  description:
    "Fetch a previously saved website and resolve each of its saved values using their candidate CSS selectors.",
  inputSchema: {
    url: z.string().url().describe("The URL of the website."),
  },
};

export async function handler({ url }) {
  const site = await get(url);

  if (!site) {
    return {
      content: [{ type: "text", text: `No site with ${url} found.` }],
    };
  }

  const values = site.values ?? [];
  const resolved = await resolveSelectorCandidates(
    url,
    values.map((v) => v.selectors),
  );
  const updatedValues = values.map((v, i) => ({ ...v, value: resolved[i] }));

  await set(url, { values: updatedValues });

  return {
    content: [{ type: "text", text: JSON.stringify(updatedValues) }],
  };
}
