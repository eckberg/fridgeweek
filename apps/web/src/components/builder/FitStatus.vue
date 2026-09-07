<script setup lang="ts">
import type { Layout, LayoutIssue } from '@fridgeweek/core';
import { computed } from 'vue';
import { t } from '../../i18n/index.js';

const props = defineProps<{
  layout: Layout;
  fit: 'comfortable' | 'tight' | 'impossible';
}>();

const headline = computed(() => {
  if (props.fit === 'impossible') return t('status.doesNotFit');
  if (props.fit === 'tight') return t('status.tight');
  return t('status.comfortable');
});

const metrics = computed(() =>
  t('status.metrics', {
    line: props.layout.metrics.lineHeight,
    mark: props.layout.metrics.markSize,
    day: props.layout.metrics.dayHeight,
  }),
);

const paper = computed(() =>
  t('status.paperSummary', {
    paper: props.layout.paper.name,
    width: props.layout.paper.width,
    height: props.layout.paper.height,
    margin: props.layout.margin,
  }),
);

/** Errors first: they are what stops the sheet from being printable. */
const notable = computed<LayoutIssue[]>(() => [
  ...props.layout.issues.filter((i) => i.severity === 'error'),
  ...props.layout.issues.filter((i) => i.severity === 'warning'),
]);
</script>

<template>
  <div class="status" :class="fit" role="status">
    <div class="line">
      <span class="dot" aria-hidden="true" />
      <strong>{{ headline }}</strong>
    </div>
    <p class="mono">{{ metrics }}</p>
    <p class="mono paper">{{ paper }}</p>

    <div v-for="issue in notable" :key="issue.code" class="issue">
      <p class="message">{{ issue.message }}</p>
      <template v-if="issue.remedies.length">
        <p class="eyebrow">{{ t('status.remedies') }}</p>
        <ul>
          <li v-for="remedy in issue.remedies" :key="remedy">{{ remedy }}</li>
        </ul>
      </template>
    </div>
  </div>
</template>

<style scoped>
/* A bar across the top of the preview: the verdict on the sheet below it. */
.status {
  display: flex;
  flex-wrap: wrap;
  align-items: baseline;
  gap: var(--space-2) var(--space-4);
  padding: 14px var(--space-5);
  background: var(--white);
  border-bottom: 1px solid var(--border);
}

.line {
  display: flex;
  align-items: center;
  gap: 9px;
  font-size: 15px;
}

.dot {
  width: 9px;
  height: 9px;
  flex: none;
  border-radius: 50%;
  background: var(--ghost);
}

.comfortable .dot {
  background: #2f7d4f;
}

.tight .dot {
  background: var(--accent-soft);
}

.impossible .dot {
  background: var(--accent);
}

.paper {
  text-transform: uppercase;
  letter-spacing: 0.08em;
  font-size: 11px;
}

.issue {
  flex-basis: 100%;
  padding: 10px 14px;
  background: var(--paper-tint);
  border-radius: var(--radius-md);
}

.message {
  font-size: 13px;
  line-height: 1.45;
}

.eyebrow {
  margin-top: var(--space-2);
  font-size: 11px;
}

ul {
  margin-top: var(--space-1);
  padding-left: 1.1em;
  font-size: 13px;
  line-height: 1.5;
  color: var(--ink-soft);
}
</style>
