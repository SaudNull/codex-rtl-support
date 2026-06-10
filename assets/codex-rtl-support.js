const RTL_LOCALES = /^(ar|arc|ary|arz|az-arab|ckb|dv|fa|ha-arab|he|iw|khw|ks|ku-arab|mzn|nqo|pnb|ps|sd|ug|ur|yi)(-|_|$)/i;
const RTL_STRONG = /[\u0590-\u08ff\ufb1d-\ufdff\ufe70-\ufeff\u{10d00}-\u{10d3f}\u{1e900}-\u{1e95f}]/u;
const LETTER = /\p{Letter}/u;

const TARGETS = [
  ".ProseMirror",
  "[contenteditable='true']",
  "[role='textbox']",
  "textarea",
  "[class*='markdownContent'] :is(p, li, h1, h2, h3, h4, h5, h6, blockquote, th, td, figcaption, summary)",
  "[class*='markdownText']",
  "[class*='messageContent']",
  "[data-message-author-role]",
  "[data-testid*='message']"
].join(",");

const SKIP = [
  "pre",
  "code",
  "kbd",
  "samp",
  ".xterm",
  ".cm-editor",
  ".monaco-editor",
  "[data-codex-rtl-ignore]",
  "[contenteditable='false']"
].join(",");

export function isRtlLocale(locale) {
  return RTL_LOCALES.test(String(locale || ""));
}

export function getTextDirection(value) {
  for (const char of String(value || "").trim()) {
    if (RTL_STRONG.test(char)) return "rtl";
    if (LETTER.test(char)) return "ltr";
  }
  return "auto";
}

export function installCodexRtlSupport(root = document) {
  const html = root.documentElement || document.documentElement;
  const locale = html.lang || navigator.language || "";

  if (isRtlLocale(locale)) {
    html.dataset.codexRtlLocale = "true";
    html.dir ||= "rtl";
  }

  const readText = element => {
    if ("value" in element) return element.value;
    return element.innerText || element.textContent || "";
  };

  const applyDirection = element => {
    if (!(element instanceof Element) || element.closest(SKIP)) return;
    const direction = getTextDirection(readText(element));
    if (direction === "auto") {
      element.removeAttribute("data-codex-rtl");
      element.setAttribute("dir", "auto");
      return;
    }
    element.dataset.codexRtl = direction;
    element.setAttribute("dir", direction);
  };

  let frame = 0;
  const sync = () => {
    frame = 0;
    root.querySelectorAll(TARGETS).forEach(applyDirection);
  };

  const queue = () => {
    if (!frame) frame = requestAnimationFrame(sync);
  };

  root.addEventListener("input", event => {
    const target = event.target;
    if (target instanceof Element) {
      applyDirection(target.closest(TARGETS) || target);
    }
  }, true);

  new MutationObserver(queue).observe(root.body || root, {
    childList: true,
    characterData: true,
    subtree: true
  });

  queue();
  return { sync };
}

if (typeof document !== "undefined") {
  installCodexRtlSupport();
}
