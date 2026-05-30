import { describe, expect, it } from 'vitest';
import { positionTooltip } from './tooltip.js';

const VW = 1000;
const VH = 800;
const tip = { width: 200, height: 40 };

describe('positionTooltip', () => {
  it('sits above the trigger when there is room', () => {
    const { top } = positionTooltip(
      { top: 400, bottom: 420, left: 400, width: 100, height: 20 },
      tip,
      VW,
      VH,
    );
    expect(top).toBe(400 - tip.height - 6); // above, minus gap
  });

  it('flips below when the trigger hugs the top edge (the Load loan case)', () => {
    const { top } = positionTooltip(
      { top: 4, bottom: 24, left: 400, width: 100, height: 20 },
      tip,
      VW,
      VH,
    );
    expect(top).toBe(24 + 6); // below the trigger
  });

  it('centers horizontally on the trigger', () => {
    const { left } = positionTooltip(
      { top: 400, bottom: 420, left: 400, width: 100, height: 20 },
      tip,
      VW,
      VH,
    );
    expect(left).toBe(450 - tip.width / 2); // trigger center 450, minus half tip
  });

  it('clamps to the left edge', () => {
    const { left } = positionTooltip(
      { top: 400, bottom: 420, left: 0, width: 20, height: 20 },
      tip,
      VW,
      VH,
    );
    expect(left).toBe(8); // MARGIN, not negative
  });

  it('clamps to the right edge', () => {
    const { left } = positionTooltip(
      { top: 400, bottom: 420, left: 980, width: 20, height: 20 },
      tip,
      VW,
      VH,
    );
    expect(left).toBe(VW - tip.width - 8); // never past the right edge
  });
});
