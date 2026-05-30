/**
 * Themed tooltips driven by the `data-tooltip="..."` attribute.
 *
 * A single floating element is shared across all triggers and positioned
 * with `getBoundingClientRect`, so it stays inside the viewport: it prefers
 * to sit above the trigger but flips below when there isn't room, and its
 * horizontal placement is clamped to the viewport edges. A pure-CSS
 * `::after` can't do either, which let tooltips on top-of-page controls
 * (e.g. the standalone "Load loan" button) render off-screen.
 *
 * Call `initTooltips()` once at app startup. Idempotent.
 */

const GAP = 6; // px between trigger and tooltip
const MARGIN = 8; // min px from any viewport edge

interface Box {
  top: number;
  bottom: number;
  left: number;
  width: number;
  height: number;
}

/**
 * Compute viewport-relative coordinates for the tooltip `tip` anchored to
 * `trigger`. Prefers sitting above the trigger, flips below when above would
 * clip the top edge, and clamps horizontally so it never leaves the viewport.
 * Pure geometry (no DOM) so it can be unit tested.
 */
export function positionTooltip(
  trigger: Box,
  tip: { width: number; height: number },
  vw: number,
  vh: number,
): { top: number; left: number } {
  let top = trigger.top - tip.height - GAP;
  if (top < MARGIN) {
    const below = trigger.bottom + GAP;
    top = below + tip.height + MARGIN <= vh ? below : Math.max(MARGIN, top);
  }

  let left = trigger.left + trigger.width / 2 - tip.width / 2;
  left = Math.min(Math.max(left, MARGIN), vw - tip.width - MARGIN);

  return { top: Math.round(top), left: Math.round(left) };
}

let tip: HTMLDivElement | null = null;
let current: HTMLElement | null = null;

function ensureTip(): HTMLDivElement {
  if (tip) return tip;
  tip = document.createElement('div');
  tip.className = 'll-tooltip';
  tip.setAttribute('role', 'tooltip');
  document.body.appendChild(tip);
  return tip;
}

function place(trigger: HTMLElement, text: string): void {
  const el = ensureTip();
  el.textContent = text;
  // Make it measurable before deciding placement.
  el.style.visibility = 'hidden';
  el.classList.add('is-visible');

  const t = trigger.getBoundingClientRect();
  const r = el.getBoundingClientRect();
  const { top, left } = positionTooltip(
    t,
    r,
    document.documentElement.clientWidth,
    document.documentElement.clientHeight,
  );

  el.style.left = `${left}px`;
  el.style.top = `${top}px`;
  el.style.visibility = '';
}

function hide(): void {
  current = null;
  if (tip) tip.classList.remove('is-visible');
}

function show(trigger: HTMLElement): void {
  const text = trigger.getAttribute('data-tooltip');
  if (!text) return;
  current = trigger;
  place(trigger, text);
}

/** Wire up global listeners that drive the shared tooltip. Safe to call repeatedly. */
export function initTooltips(): void {
  if (typeof document === 'undefined') return;
  if ((globalThis as { __llTooltips?: boolean }).__llTooltips) return;
  (globalThis as { __llTooltips?: boolean }).__llTooltips = true;

  document.addEventListener('pointerover', (e) => {
    const trigger = (e.target as Element | null)?.closest<HTMLElement>('[data-tooltip]');
    if (trigger && trigger !== current) show(trigger);
  });

  document.addEventListener('pointerout', (e) => {
    if (!current) return;
    // Ignore moves that stay within the current trigger (e.g. onto a child).
    const to = e.relatedTarget as Node | null;
    if (to && current.contains(to)) return;
    hide();
  });

  document.addEventListener('focusin', (e) => {
    const trigger = (e.target as Element | null)?.closest<HTMLElement>('[data-tooltip]');
    if (!trigger) return;
    // Only on keyboard focus, matching the old `:focus-visible` behaviour.
    try {
      if (!trigger.matches(':focus-visible')) return;
    } catch {
      /* :focus-visible unsupported, show anyway */
    }
    show(trigger);
  });

  document.addEventListener('focusout', (e) => {
    if (!current) return;
    const to = e.relatedTarget as Node | null;
    if (to && current.contains(to)) return;
    hide();
  });

  // Position is computed once on show, so dismiss on anything that would move it.
  window.addEventListener('scroll', hide, true);
  window.addEventListener('resize', hide);
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') hide();
  });
}
