<script setup lang="ts">
import { computed } from 'vue';
import { chartPalette } from './palette.js';
import { formatShortCurrency } from './scale.js';

const props = defineProps<{
  /** Equity as an absolute amount (positive or negative). */
  equity: number;
  /** Property value — the denominator for the gauge fill fraction. */
  propertyValue: number;
  currency?: string;
}>();

/**
 * 3/4 arc geometry: sweep 270° from bottom-left (7 o'clock) to bottom-right
 * (5 o'clock), i.e. start at 135° and end at 45° going clockwise.
 */
const radius = 96;
const strokeWidth = 8;
const size = radius * 2 + strokeWidth * 2 + 32;

const startAngle = 135;
const sweepAngle = 270;

const circumference = computed(() => (Math.PI * radius * 2 * sweepAngle) / 360);

const fraction = computed(() => {
  if (props.propertyValue <= 0) return 0;
  return Math.max(0, Math.min(1, props.equity / props.propertyValue));
});

const filledLength = computed(() => circumference.value * fraction.value);
const trackLength = computed(() => circumference.value);

const cx = size / 2;
const cy = size / 2;

function polar(r: number, angleDeg: number): { x: number; y: number } {
  const rad = ((angleDeg - 90) * Math.PI) / 180;
  return { x: cx + r * Math.cos(rad), y: cy + r * Math.sin(rad) };
}

const arcPath = computed(() => {
  const start = polar(radius, startAngle);
  const end = polar(radius, startAngle + sweepAngle);
  const largeArc = sweepAngle > 180 ? 1 : 0;
  return `M${start.x},${start.y} A${radius},${radius} 0 ${largeArc} 1 ${end.x},${end.y}`;
});

const fractionPct = computed(() => Math.round(fraction.value * 100));
</script>

<template>
  <figure class="gauge">
    <svg
      :viewBox="`0 0 ${size} ${size}`"
      role="img"
      :aria-label="`Equity gauge, ${fractionPct}% of property value`"
    >
      <!-- Background track -->
      <path
        :d="arcPath"
        fill="none"
        :stroke="chartPalette.gauge.track"
        :stroke-width="strokeWidth"
        stroke-linecap="round"
      />
      <!-- Filled portion -->
      <path
        :d="arcPath"
        fill="none"
        :stroke="chartPalette.gauge.fill"
        :stroke-width="strokeWidth"
        stroke-linecap="round"
        :stroke-dasharray="`${filledLength} ${trackLength}`"
      />
      <!-- Center label -->
      <text :x="cx" :y="cy - 18" text-anchor="middle" class="eyebrow">EQUITY</text>
      <text :x="cx" :y="cy + 14" text-anchor="middle" class="hero-number">
        {{ formatShortCurrency(props.equity, props.currency) }}
      </text>
      <text :x="cx" :y="cy + 42" text-anchor="middle" class="fraction">
        {{ fractionPct }}% of {{ formatShortCurrency(props.propertyValue, props.currency) }}
      </text>
    </svg>
  </figure>
</template>

<style scoped>
.gauge {
  margin: 0;
  display: flex;
  justify-content: center;
}

svg {
  width: 100%;
  max-width: 280px;
  height: auto;
}

.eyebrow {
  font-family: var(--ll-font-sans);
  font-size: 10px;
  font-weight: 500;
  letter-spacing: 0.12em;
  fill: var(--ll-ink-muted);
}

.hero-number {
  font-family: var(--ll-font-serif);
  font-size: 32px;
  font-weight: 400;
  fill: var(--ll-ink);
  font-feature-settings:
    'tnum' 1,
    'lnum' 1;
  font-variant-numeric: tabular-nums lining-nums;
}

.fraction {
  font-family: var(--ll-font-sans);
  font-size: 11px;
  font-weight: 400;
  fill: var(--ll-ink-muted);
  font-feature-settings:
    'tnum' 1,
    'lnum' 1;
  font-variant-numeric: tabular-nums lining-nums;
}
</style>
