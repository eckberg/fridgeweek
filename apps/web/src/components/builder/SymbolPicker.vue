<script setup lang="ts">
import { SYMBOL_IDS, type SymbolId, symbolLabel } from '@fridgeweek/core';
import { computed, nextTick, ref, useId, watch } from 'vue';
import { t } from '../../i18n/index.js';
import SymbolMark from './SymbolMark.vue';

const model = defineModel<SymbolId>({ required: true });

const props = defineProps<{
  /** Symbols already taken by someone else, shown but not selectable. */
  taken: SymbolId[];
  /** Owned by the parent, so only one grid is open across the whole list. */
  open: boolean;
  buttonLabel: string;
}>();

const emit = defineEmits<{ toggle: [] }>();

const query = ref('');
const searchInput = ref<HTMLInputElement | null>(null);
const gridId = useId();

const matches = computed(() => {
  const needle = query.value.trim().toLowerCase();
  if (!needle) return SYMBOL_IDS;
  return SYMBOL_IDS.filter(
    (id) => id.includes(needle) || symbolLabel(id).toLowerCase().includes(needle),
  );
});

function isTaken(id: SymbolId): boolean {
  return id !== model.value && props.taken.includes(id);
}

function choose(id: SymbolId): void {
  if (isTaken(id)) return;
  model.value = id;
  emit('toggle');
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
    :aria-label="buttonLabel"
    :aria-expanded="open"
    :aria-controls="gridId"
    @click="emit('toggle')"
  >
    <SymbolMark :id="model" :size="20" />
  </button>

  <!--
    The grid opens inside the person's own row rather than floating over the
    panel, so the symbol being changed and the person it belongs to stay
    together and nothing is hidden behind a popover.
  -->
  <div
    v-if="open"
    :id="gridId"
    class="grid-panel"
    role="group"
    :aria-label="t('people.symbolPickerTitle')"
    @keydown.esc.stop="emit('toggle')"
  >
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
          :class="{ selected: id === model, taken: isTaken(id) }"
          :aria-pressed="id === model"
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

.grid-panel {
  order: 99;
  width: 100%;
  margin-top: 10px;
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
