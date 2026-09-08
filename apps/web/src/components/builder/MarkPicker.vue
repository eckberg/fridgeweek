<script setup lang="ts">
import { type Person, SYMBOL_IDS, type SymbolId, symbolLabel } from '@fridgeweek/core';
import { computed, nextTick, ref, useId, watch } from 'vue';
import { t } from '../../i18n/index.js';
import SymbolMark from './SymbolMark.vue';

/**
 * One person's mark, which is either a symbol or their initials. Both live in
 * the same panel because they are the same choice: typing letters is how you
 * stop being a picture, and picking a picture is how you stop being letters.
 */
const props = defineProps<{
  /** Kept whether or not it is what gets drawn, so letters can be undone. */
  symbol: SymbolId;
  /** Set when this person is drawn as letters instead of their symbol. */
  initial: string | undefined;
  /** The letters they would get, shown as the placeholder until they type. */
  suggestedInitial: string;
  /** Symbols already taken by someone else, shown but not selectable. */
  taken: SymbolId[];
  /** Owned by the parent, so only one panel is open across the whole list. */
  open: boolean;
  buttonLabel: string;
  initialsLabel: string;
}>();

const emit = defineEmits<{
  update: [change: Partial<Person>];
  toggle: [];
}>();

const query = ref('');
const searchInput = ref<HTMLInputElement | null>(null);
const panelId = useId();
const initialsId = useId();

const usesInitial = computed(() => props.initial !== undefined);

const matches = computed(() => {
  const needle = query.value.trim().toLowerCase();
  if (!needle) return SYMBOL_IDS;
  return SYMBOL_IDS.filter(
    (id) => id.includes(needle) || symbolLabel(id).toLowerCase().includes(needle),
  );
});

function isTaken(id: SymbolId): boolean {
  return id !== props.symbol && props.taken.includes(id);
}

function choose(id: SymbolId): void {
  if (isTaken(id)) return;
  emit('update', { symbol: id, initial: undefined });
  emit('toggle');
}

function onInitials(event: Event): void {
  const value = (event.target as HTMLInputElement).value.trim();
  emit('update', { initial: value === '' ? undefined : value });
}

watch(
  () => props.open,
  async (isOpen) => {
    if (!isOpen) {
      query.value = '';
      return;
    }
    await nextTick();
    searchInput.value?.focus();
  },
);
</script>

<template>
  <button
    type="button"
    class="trigger"
    :class="{ letters: usesInitial }"
    :aria-label="buttonLabel"
    :aria-expanded="open"
    :aria-controls="panelId"
    @click="emit('toggle')"
  >
    <span v-if="initial !== undefined" class="trigger-initial">{{ initial }}</span>
    <SymbolMark v-else :id="symbol" :size="20" />
  </button>

  <!--
    The panel opens inside the person's own row rather than floating over the
    panel, so the mark being changed and the person it belongs to stay together
    and nothing is hidden behind a popover.
  -->
  <div
    v-if="open"
    :id="panelId"
    class="mark-panel"
    role="group"
    :aria-label="t('people.markPickerTitle')"
    @keydown.esc.stop="emit('toggle')"
  >
    <div class="initials" :class="{ chosen: usesInitial }">
      <label :for="initialsId" class="initials-label">{{ t('people.initials') }}</label>
      <input
        :id="initialsId"
        class="initials-input"
        type="text"
        maxlength="2"
        :value="initial ?? ''"
        :placeholder="suggestedInitial"
        :aria-label="initialsLabel"
        @input="onInitials"
      />
      <p class="initials-help">{{ t('people.initialsHelp') }}</p>
    </div>

    <p class="section">{{ t('people.symbols') }}</p>
    <input
      ref="searchInput"
      v-model="query"
      type="search"
      class="search"
      :placeholder="t('people.symbolSearch')"
      :aria-label="t('people.symbolSearch')"
    />
    <p v-if="matches.length === 0" class="empty">{{ t('people.symbolNoResults') }}</p>
    <ul v-else class="grid">
      <li v-for="id in matches" :key="id">
        <button
          type="button"
          class="option"
          :class="{ selected: id === symbol && !usesInitial, taken: isTaken(id) }"
          :aria-pressed="id === symbol && !usesInitial"
          :disabled="isTaken(id)"
          :title="symbolLabel(id)"
          @click="choose(id)"
        >
          <SymbolMark :id="id" :size="20" :title="symbolLabel(id)" />
        </button>
      </li>
    </ul>
  </div>
</template>

<style scoped>
.trigger {
  display: grid;
  place-items: center;
  width: 34px;
  height: 34px;
  flex: none;
  border: 1px solid var(--border);
  border-radius: var(--radius-sm);
  background: var(--white);
  color: var(--ink);
  cursor: pointer;
}

.trigger:hover,
.trigger[aria-expanded='true'] {
  border-color: var(--accent-mid);
  color: var(--accent);
}

/* The same box either way, so a row does not change shape with the mark. */
.trigger-initial {
  font: 700 15px/1 var(--font-mono);
}

.mark-panel {
  order: 99;
  width: 100%;
  margin-top: 10px;
}

/*
 * The letters sit above the pictures as the first thing in the panel, because
 * they are the option that is easy to miss: a grid of symbols looks complete
 * on its own.
 */
.initials {
  display: grid;
  grid-template-columns: 1fr auto;
  align-items: center;
  gap: 4px var(--space-3);
  padding: 8px 10px;
  border: 1px solid var(--border);
  border-radius: var(--radius-sm);
  background: var(--white);
}

.initials.chosen {
  border-color: var(--accent);
  background: var(--paper-tint);
}

.initials-label {
  font-size: 14px;
  font-weight: 700;
}

.initials-input {
  grid-row: 1 / 3;
  grid-column: 2;
  width: 52px;
  height: 34px;
  padding: 0 8px;
  border: 1px solid var(--rule);
  border-radius: var(--radius-sm);
  background: var(--white);
  font: 500 15px/1 var(--font-mono);
  text-align: center;
  color: var(--ink);
}

.initials-input:focus {
  border-color: var(--accent-mid);
}

.initials-help {
  font-size: 12px;
  line-height: 1.4;
  color: var(--ink-faint);
}

.section {
  margin: var(--space-3) 0 var(--space-2);
  font-size: 12px;
  font-weight: 500;
  letter-spacing: 0.12em;
  text-transform: uppercase;
  color: var(--ink-faint);
}

.search {
  width: 100%;
  height: 32px;
  margin-bottom: var(--space-2);
  padding: 0 10px;
  border: 1px solid var(--border);
  border-radius: var(--radius-sm);
  font: inherit;
  font-size: 14px;
}

.search:focus {
  border-color: var(--accent-mid);
}

.grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(32px, 1fr));
  gap: 6px;
  max-height: 220px;
  overflow-y: auto;
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
  padding: var(--space-3) var(--space-1);
  font-size: 14px;
  color: var(--ink-faint);
}
</style>
