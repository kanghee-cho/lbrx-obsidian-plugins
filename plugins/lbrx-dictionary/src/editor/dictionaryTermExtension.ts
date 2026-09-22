import { Decoration, DecorationSet, EditorView, ViewPlugin, ViewUpdate, WidgetType } from "@codemirror/view";
import { RangeSetBuilder } from "@codemirror/state";
import type { DictionaryTooltip } from "../ui/tooltip";
import type { LbrxDictionarySettings } from "../settings";

/** Escapes a string so it can be embedded literally inside a RegExp. */
function escapeForRegex(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/**
 * Builds the "delimiter word delimiter" matcher (e.g. `::word::` when
 * delimiter is "::"). Non-greedy so `::a:: text ::b::` matches two terms
 * instead of one spanning both.
 */
export function buildTermRegex(delimiter: string): RegExp {
  const esc = escapeForRegex(delimiter);
  return new RegExp(`${esc}([^\\n]+?)${esc}`, "g");
}

class TermWidget extends WidgetType {
  constructor(private readonly word: string, private readonly tooltip: DictionaryTooltip) {
    super();
  }

  eq(other: TermWidget): boolean {
    return other.word === this.word;
  }

  toDOM(): HTMLElement {
    const span = document.createElement("span");
    span.className = "lbrx-dictionary-term";
    span.textContent = this.word;
    span.addEventListener("mouseenter", () => this.tooltip.scheduleShow(this.word, span));
    span.addEventListener("mouseleave", () => {
      this.tooltip.cancelShow();
      this.tooltip.scheduleHide();
    });
    return span;
  }
}

/**
 * Live Preview (CodeMirror 6) extension: replaces `::word::` spans in the
 * visible viewport with a styled widget that shows a definition tooltip on
 * hover. Rebuilds its decorations whenever the document or viewport changes.
 */
export function createDictionaryTermExtension(
  getSettings: () => LbrxDictionarySettings,
  tooltip: DictionaryTooltip,
) {
  return ViewPlugin.fromClass(
    class {
      decorations: DecorationSet;

      constructor(view: EditorView) {
        this.decorations = this.build(view);
      }

      update(update: ViewUpdate) {
        if (update.docChanged || update.viewportChanged) {
          this.decorations = this.build(update.view);
        }
      }

      build(view: EditorView): DecorationSet {
        const builder = new RangeSetBuilder<Decoration>();
        const regex = buildTermRegex(getSettings().termDelimiter);

        for (const { from, to } of view.visibleRanges) {
          const text = view.state.sliceDoc(from, to);
          regex.lastIndex = 0;
          let match: RegExpExecArray | null;
          while ((match = regex.exec(text))) {
            const start = from + match.index;
            const end = start + match[0].length;
            builder.add(start, end, Decoration.replace({ widget: new TermWidget(match[1], tooltip) }));
          }
        }
        return builder.finish();
      }
    },
    {
      decorations: (plugin) => plugin.decorations,
    },
  );
}
