import puppeteer from "puppeteer";

const IDLE_TIMEOUT_MS = Number(process.env.BROWSER_IDLE_TIMEOUT_MS) || 60_000;

let browserPromise = null;
let idleTimer = null;

function launchBrowser() {
  const args = process.env.PUPPETEER_EXECUTABLE_PATH
    ? ["--no-sandbox", "--disable-setuid-sandbox"]
    : [];
  return puppeteer.launch({ headless: true, args });
}

async function getBrowser() {
  clearTimeout(idleTimer);
  if (!browserPromise) {
    browserPromise = launchBrowser();
    const browser = await browserPromise;
    // The browser can die on its own (crash, killed externally); drop the
    // cached instance so the next call launches a fresh one instead of
    // reusing a dead reference.
    browser.on("disconnected", () => {
      browserPromise = null;
      clearTimeout(idleTimer);
    });
  }
  return browserPromise;
}

function scheduleIdleClose() {
  clearTimeout(idleTimer);
  idleTimer = setTimeout(async () => {
    const promise = browserPromise;
    browserPromise = null;
    const browser = await promise;
    await browser?.close();
  }, IDLE_TIMEOUT_MS);
  // Don't let this timer keep a short-lived process (e.g. a script) alive.
  idleTimer.unref?.();
}

async function withPage(url, task) {
  const browser = await getBrowser();
  const page = await browser.newPage();
  try {
    await page.goto(url, { waitUntil: "networkidle0" });
    return await task(page);
  } finally {
    await page.close();
    scheduleIdleClose();
  }
}

export async function getBody(url) {
  return withPage(url, (page) =>
    page.evaluate(() => {
      document
        .querySelectorAll("script, style, noscript, svg, meta, link, template")
        .forEach((el) => el.remove());
      return document.body.innerHTML;
    }),
  );
}

export async function getElementBySelector(url, selector) {
  return withPage(url, (page) =>
    page.evaluate((selector) => {
      const el = document.querySelector(selector);
      return el ? el.outerHTML : null;
    }, selector),
  );
}

export async function getElementsBySelectors(url, selectors) {
  return withPage(url, (page) =>
    page.evaluate((selectors) => {
      return selectors.map((selector) => {
        const el = document.querySelector(selector);
        return el ? el.outerHTML : null;
      });
    }, selectors),
  );
}

// Resolves multiple candidate-selector groups against one page load. Each
// group is a fallback list (e.g. up to 3 selectors for the same value); the
// first selector in a group that matches an element wins.
export async function resolveSelectorCandidates(url, selectorGroups) {
  return withPage(url, (page) =>
    page.evaluate((selectorGroups) => {
      return selectorGroups.map((selectors) => {
        for (const selector of selectors) {
          const el = document.querySelector(selector);
          if (el) return el.textContent.trim();
        }
        return null;
      });
    }, selectorGroups),
  );
}

export async function fetchBodyHtml(url) {
  return withPage(url, (page) =>
    page.evaluate(() => {
      document
        .querySelectorAll("script, style, noscript, svg, meta, link, template")
        .forEach((el) => el.remove());
      return document.body.innerHTML;
    }),
  );
}
