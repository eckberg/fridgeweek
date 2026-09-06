<script setup lang="ts">
import type { Layout, LayoutIssue } from '@fridgeweek/core';
import { computed } from 'vue';
import type { MessageKey } from '../../i18n/index.js';

const props = defineProps<{
  layout: Layout;
  fit: 'comfortable' | 'tight' | 'impossible';
  t: (key: MessageKey, params?: Record<string, string | number>) => string;
}>();

const headline = computed(() => {
  if (props.fit === 'impossible') return props.t('status.doesNotFit');
  if (props.fit === 'tight') return props.t('status.tight');
  return props.t('status.comfortable');
});

const metrics = computed(() =>
  props.t('status.metrics', {
    line: props.layout.metrics.lineHeight,
    mark: props.layout.metrics.markSize,
    day: props.layout.metrics.dayHeight,
  }),
);

const paper = computed(() =>
  props.t('status.paperSummary', {
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
.status {
  display: flex;
  flex-direction: column;
  gap: var(--space-2);
  padding: var(--space-4) var(--space-5);
}

.line {
  display: flex;
  align-items: center;
  gap: var(--space-2);
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
  margin-top: var(--space-2);
  padding: var(--space-3);
  border-left: 2px solid var(--accent-soft);
  background: var(--paper-tint);
  border-radius: 0 var(--radius-sm) var(--radius-sm) 0;
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
