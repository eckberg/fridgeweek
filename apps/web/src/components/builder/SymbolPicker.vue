<script setup lang="ts">
import { getSymbol, SYMBOL_IDS, type SymbolId } from '@fridgeweek/core';
import { computed, nextTick, ref, useId, watch } from 'vue';
import type { MessageKey } from '../../i18n/index.js';
import SymbolMark from './SymbolMark.vue';

const model = defineModel<SymbolId>({ required: true });

const props = defineProps<{
  /** Symbols already taken by someone else, shown but not selectable. */
  taken: SymbolId[];
  locale: string;
  t: (key: MessageKey, params?: Record<string, string | number>) => string;
  buttonLabel: string;
}>();

const open = ref(false);
const query = ref('');
const searchInput = ref<HTMLInputElement | null>(null);
const dialog = ref<HTMLElement | null>(null);
const panelId = useId();

/** Symbol labels are only translated into a few languages so far; English is the fallback. */
function labelFor(id: SymbolId): string {
  const labels = getSymbol(id).labels as Record<string, string | undefined>;
  const language = props.locale.split('-')[0] ?? 'en';
  return labels[language] ?? labels.en ?? id;
}

const matches = computed(() => {
  const needle = query.value.trim().toLowerCase();
  if (!needle) return SYMBOL_IDS;
  return SYMBOL_IDS.filter(
    (id) => id.includes(needle) || labelFor(id).toLowerCase().includes(needle),
  );
});

function isTaken(id: SymbolId): boolean {
  return id !== model.value && props.taken.includes(id);
}

function choose(id: SymbolId): void {
  if (isTaken(id)) return;
  model.value = id;
  close();
}

function close(): void {
  open.value = false;
  query.value = '';
}

watch(open, async (isOpen) => {
  if (!isOpen) return;
  await nextTick();
  searchInput.value?.focus();
});

function onKeydown(event: KeyboardEvent): void {
  if (event.key === 'Escape') {
    event.stopPropagation();
    close();
  }
}

/** Closing on an outside click keeps the panel out of the way without a modal overlay. */
function onFocusOut(event: FocusEvent): void {
  const next = event.relatedTarget;
  if (next instanceof Node && dialog.value?.contains(next)) return;
  close();
}
</script>

<template>
  <div ref="dialog" class="picker" @keydown="onKeydown" @focusout="onFocusOut">
    <button
      type="button"
      class="trigger"
      :aria-label="buttonLabel"
      :aria-expanded="open"
      :aria-controls="panelId"
      @click="open = !open"
    >
      <SymbolMark :id="model" :size="20" />
    </button>

    <div v-if="open" :id="panelId" class="panel" role="dialog" :aria-label="t('people.symbolPickerTitle')">
      <input
        ref="searchInput"
        v-model="query"
        type="search"
        class="search"
        :placeholder="t('people.symbolSearch')"
        :aria-label="t('people.symbolSearch')"
      />
      <div v-if="matches.length === 0" class="empty">{{ t('people.symbolNoResults') }}</div>
      <ul v-else class="grid">
        <li v-for="id in matches" :key="id">
          <button
            type="button"
            class="option"
            :class="{ selected: id === model, taken: isTaken(id) }"
            :aria-pressed="id === model"
            :disabled="isTaken(id)"
            :title="labelFor(id)"
            @click="choose(id)"
          >
            <SymbolMark :id="id" :size="22" :title="labelFor(id)" />
          </button>
        </li>
      </ul>
    </div>
  </div>
</template>

<style scoped>
.picker {
  position: relative;
}

.trigger {
  display: grid;
  place-items: center;
  width: 38px;
  height: 38px;
  border: 1px solid var(--border);
  border-radius: var(--radius-md);
  background: var(--white);
  color: var(--ink);
  cursor: pointer;
}

.trigger:hover,
.trigger[aria-expanded='true'] {
  border-color: var(--accent-mid);
  color: var(--accent);
}

.panel {
  position: absolute;
  z-index: 20;
  top: calc(100% + 6px);
  left: 0;
  width: 296px;
  max-height: 320px;
  overflow-y: auto;
  padding: var(--space-3);
  border: 1px solid var(--border);
  border-radius: var(--radius-lg);
  background: var(--white);
  box-shadow: 0 8px 28px rgba(0, 0, 0, 0.14);
}

.search {
  width: 100%;
  margin-bottom: var(--space-3);
  padding: var(--space-2) var(--space-3);
  border: 1px solid var(--border);
  border-radius: var(--radius-sm);
  font: inherit;
  font-size: 14px;
}

.grid {
  display: grid;
  grid-template-columns: repeat(7, 1fr);
  gap: 4px;
  list-style: none;
}

.option {
  display: grid;
  place-items: center;
  width: 100%;
  aspect-ratio: 1;
  border: 1px solid transparent;
  border-radius: var(--radius-sm);
  background: transparent;
  color: var(--ink-soft);
  cursor: pointer;
}

.option:hover:not(:disabled) {
  background: var(--paper-tint);
  color: var(--ink);
}

.option.selected {
  border-color: var(--accent);
  background: var(--paper-tint);
  color: var(--accent);
}

.option.taken {
  opacity: 0.25;
  cursor: not-allowed;
}

.empty {
  padding: var(--space-4) var(--space-2);
  font-size: 14px;
  color: var(--ink-faint);
}
</style>
