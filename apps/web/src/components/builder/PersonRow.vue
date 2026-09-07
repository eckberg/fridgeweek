<script setup lang="ts">
import { type Person, personInitial, type SymbolId } from '@fridgeweek/core';
import { computed, useId } from 'vue';
import { t } from '../../i18n/index.js';
import SymbolPicker from './SymbolPicker.vue';

const props = defineProps<{
  person: Person;
  position: number;
  taken: SymbolId[];
  canRemove: boolean;
}>();

const emit = defineEmits<{
  update: [change: Partial<Person>];
  remove: [];
}>();

const nameId = useId();
const initialId = useId();

/** Falls back to the position when the name is still empty, so labels are never blank. */
const displayName = computed(
  () => props.person.name.trim() || t('people.nameLabel', { position: props.position }),
);

const symbol = computed({
  get: () => props.person.symbol,
  set: (value: SymbolId) => emit('update', { symbol: value }),
});

const shownInitial = computed(() => personInitial(props.person));

function onName(event: Event): void {
  emit('update', { name: (event.target as HTMLInputElement).value });
}

function onInitial(event: Event): void {
  const value = (event.target as HTMLInputElement).value.trim();
  emit('update', value ? { initial: value } : { initial: undefined });
}
</script>

<template>
  <li class="person">
    <SymbolPicker
      v-model="symbol"
      :taken="taken"
      :t="t"
      :button-label="t('people.symbolLabel', { name: displayName })"
    />

    <input
      :id="nameId"
      class="name"
      type="text"
      :value="person.name"
      maxlength="24"
      :placeholder="t('people.namePlaceholder')"
      :aria-label="t('people.nameLabel', { position })"
      @input="onName"
    />

    <input
      :id="initialId"
      class="initial"
      type="text"
      :value="shownInitial"
      maxlength="2"
      :aria-label="t('people.initialLabel', { name: displayName })"
      @input="onInitial"
    />

    <button
      v-if="canRemove"
      type="button"
      class="remove"
      :aria-label="t('people.removeLabel', { name: displayName })"
      @click="emit('remove')"
    >
      <span aria-hidden="true">&times;</span>
    </button>
    <span v-else class="remove-spacer" />
  </li>
</template>

<style scoped>
.person {
  display: flex;
  align-items: center;
  gap: var(--space-2);
  list-style: none;
}

input {
  height: 38px;
  padding: 0 var(--space-3);
  border: 1px solid var(--border);
  border-radius: var(--radius-md);
  background: var(--white);
  font: inherit;
  font-size: 15px;
  color: var(--ink);
  min-width: 0;
}

input:focus {
  border-color: var(--accent-mid);
}

.name {
  flex: 1;
}

.initial {
  width: 46px;
  flex: none;
  text-align: center;
  font: 500 15px/1 var(--font-mono);
}

.remove,
.remove-spacer {
  width: 30px;
  height: 30px;
  flex: none;
}

.remove {
  display: grid;
  place-items: center;
  border: none;
  border-radius: var(--radius-sm);
  background: transparent;
  color: var(--ink-faint);
  font-size: 20px;
  line-height: 1;
  cursor: pointer;
}

.remove:hover {
  background: var(--paper-tint);
  color: var(--accent);
}
</style>
