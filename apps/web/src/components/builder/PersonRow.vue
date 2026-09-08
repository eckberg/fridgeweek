<script setup lang="ts">
import { type Person, personInitial, type SymbolId } from '@fridgeweek/core';
import { computed, useId } from 'vue';
import { t } from '../../i18n/index.js';
import MarkPicker from './MarkPicker.vue';

const props = defineProps<{
  person: Person;
  position: number;
  taken: SymbolId[];
  canRemove: boolean;
  /** Only one person's mark panel is open at a time, so the list stays short. */
  open: boolean;
}>();

const emit = defineEmits<{
  update: [change: Partial<Person>];
  remove: [];
  toggle: [];
}>();

const nameId = useId();

/** Falls back to the position when the name is still empty, so labels are never blank. */
const displayName = computed(
  () => props.person.name.trim() || t('people.nameLabel', { position: props.position }),
);

function onName(event: Event): void {
  emit('update', { name: (event.target as HTMLInputElement).value });
}
</script>

<template>
  <li class="person" :class="{ open }">
    <div class="row">
      <MarkPicker
        :symbol="person.symbol"
        :initial="person.initial"
        :suggested-initial="personInitial(person)"
        :taken="taken"
        :open="open"
        :button-label="t('people.markLabel', { name: displayName })"
        :initials-label="t('people.initialsLabel', { name: displayName })"
        @update="(change) => emit('update', change)"
        @toggle="emit('toggle')"
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
    </div>
  </li>
</template>

<style scoped>
/*
 * A person is a bordered row. Opening the mark panel turns the row into a card
 * in the accent colour, so it is obvious which person is being changed.
 */
.person {
  list-style: none;
  padding: 6px 8px 6px 12px;
  background: var(--white);
  border: 1px solid var(--border);
  border-radius: var(--radius-md);
}

.person.open {
  padding: 12px;
  border: 2px solid var(--accent-mid);
}

.row {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 10px;
}

input {
  height: 34px;
  padding: 0 10px;
  border: 1px solid transparent;
  border-radius: var(--radius-sm);
  background: transparent;
  font: inherit;
  font-size: 15px;
  color: var(--ink);
  min-width: 0;
}

input:hover {
  border-color: var(--border);
}

input:focus {
  border-color: var(--accent-mid);
  background: var(--white);
}

.name {
  flex: 1;
}

.remove,
.remove-spacer {
  width: 28px;
  height: 28px;
  flex: none;
}

.remove {
  display: grid;
  place-items: center;
  border: none;
  border-radius: var(--radius-sm);
  background: transparent;
  color: var(--ink-faint);
  font-size: 19px;
  line-height: 1;
  cursor: pointer;
}

.remove:hover {
  background: var(--paper-tint);
  color: var(--accent);
}
</style>
