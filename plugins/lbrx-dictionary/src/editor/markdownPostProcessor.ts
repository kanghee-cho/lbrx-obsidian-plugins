import type { Plugin } from "obsidian";
import type { DictionaryTooltip } from "../ui/tooltip";
import type { LbrxDictionarySettings } from "../settings";
import { buildTermRegex } from "./dictionaryTermExtension";

/**
 * Reading-mode counterpart to `dictionaryTermExtension`: walks the rendered
 * markdown's text nodes and replaces `::word::` matches with the same
 * hoverable span used in Live Preview.
 */
export function registerDictionaryPostProcessor(
  plugin: Plugin,
  getSettings: () => LbrxDictionarySettings,
  tooltip: DictionaryTooltip,
): void {
  plugin.registerMarkdownPostProcessor((el) => {
    const regex = buildTermRegex(getSettings().termDelimiter);
    const walker = document.createTreeWalker(el, NodeFilter.SHOW_TEXT);
    const textNodes: Text[] = [];
    let node: Node | null;
    while ((node = walker.nextNode())) {
      textNodes.push(node as Text);
    }

    for (const textNode of textNodes) {
      const text = textNode.textContent ?? "";
      regex.lastIndex = 0;
      if (!regex.test(text)) continue;

      const frag = document.createDocumentFragment();
      let lastIndex = 0;
      regex.lastIndex = 0;
      let match: RegExpExecArray | null;
      while ((match = regex.exec(text))) {
        if (match.index > lastIndex) {
          frag.appendChild(document.createTextNode(text.slice(lastIndex, match.index)));
        }
        const word = match[1];
        const span = document.createElement("span");
        span.className = "lbrx-dictionary-term";
        span.textContent = word;
        span.addEventListener("mouseenter", () => tooltip.show(word, span));
        span.addEventListener("mouseleave", () => tooltip.scheduleHide());
        frag.appendChild(span);
        lastIndex = match.index + match[0].length;
      }
      if (lastIndex < text.length) {
        frag.appendChild(document.createTextNode(text.slice(lastIndex)));
      }
      textNode.replaceWith(frag);
    }
  });
}
