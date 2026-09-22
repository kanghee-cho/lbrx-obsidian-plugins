/**
 * `definition_html` comes straight from each source dictionary's original
 * markup, which hardcodes inline text colors (`<font color="...">` or
 * `style="color:..."`) for things like cross-references, grammar labels,
 * or example highlighting. Those colors were picked against each
 * dictionary's own (usually white) page background, not our per-marker
 * tinted box or Obsidian's dark theme — Longman/Oxford/Macmillan/Collins/
 * Korean-dictionary entries all use various blues/purples/greens/reds that
 * can end up nearly invisible once actually rendered.
 *
 * Rather than hardcoding fixes for the handful of colors spot-checked so
 * far, this scans every element with an explicit inline color right after
 * render, measures the real WCAG contrast ratio against its actual
 * rendered background, and nudges only the ones that fail toward the
 * theme's normal text color — just enough to pass, so the dictionary's own
 * color-coding stays visually distinct instead of being flattened.
 */

const MIN_CONTRAST_RATIO = 3.5;

interface Rgb {
  r: number;
  g: number;
  b: number;
}

function parseRgb(value: string): Rgb | undefined {
  const match = value.match(/rgba?\(([^)]+)\)/);
  if (!match) return undefined;
  const parts = match[1].split(",").map((part) => parseFloat(part.trim()));
  if (parts.length < 3 || parts.some((n) => Number.isNaN(n))) return undefined;
  const [r, g, b, a] = parts;
  if (a === 0) return undefined; // fully transparent: not a usable background
  return { r, g, b };
}

/** Walks up from `el` until it finds an ancestor with a non-transparent background. */
function getEffectiveBackgroundColor(el: HTMLElement): Rgb {
  let node: HTMLElement | null = el;
  while (node) {
    const bg = parseRgb(getComputedStyle(node).backgroundColor);
    if (bg) return bg;
    node = node.parentElement;
  }
  return { r: 255, g: 255, b: 255 };
}

function relativeLuminance({ r, g, b }: Rgb): number {
  const toLinear = (channel: number) => {
    const s = channel / 255;
    return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
  };
  return 0.2126 * toLinear(r) + 0.7152 * toLinear(g) + 0.0722 * toLinear(b);
}

function contrastRatio(a: Rgb, b: Rgb): number {
  const l1 = relativeLuminance(a) + 0.05;
  const l2 = relativeLuminance(b) + 0.05;
  return l1 > l2 ? l1 / l2 : l2 / l1;
}

function blend(a: Rgb, b: Rgb, t: number): Rgb {
  return {
    r: Math.round(a.r + (b.r - a.r) * t),
    g: Math.round(a.g + (b.g - a.g) * t),
    b: Math.round(a.b + (b.b - a.b) * t),
  };
}

/**
 * Fixes up any low-contrast inline-colored text found under `root` in
 * place. Safe to call on plain text with no colored elements (no-op).
 */
export function fixLowContrastText(root: HTMLElement): void {
  const candidates = Array.from(root.querySelectorAll<HTMLElement>("*")).filter(
    (el) => el.hasAttribute("color") || /color\s*:/.test(el.getAttribute("style") ?? ""),
  );
  if (candidates.length === 0) return;

  const normalColor = parseRgb(getComputedStyle(root).color) ?? { r: 128, g: 128, b: 128 };

  for (const el of candidates) {
    const background = getEffectiveBackgroundColor(el);
    const foreground = parseRgb(getComputedStyle(el).color);
    if (!foreground) continue;
    if (contrastRatio(foreground, background) >= MIN_CONTRAST_RATIO) continue;

    // Blend the original color toward the theme's normal text color in
    // steps, stopping as soon as contrast passes, so the color-coding
    // stays recognizable instead of being replaced outright.
    let adjusted = foreground;
    for (let step = 1; step <= 10; step++) {
      adjusted = blend(foreground, normalColor, step / 10);
      if (contrastRatio(adjusted, background) >= MIN_CONTRAST_RATIO) break;
    }
    el.style.color = `rgb(${adjusted.r}, ${adjusted.g}, ${adjusted.b})`;
  }
}
