<script setup lang="ts">
import { type Person, personInitial } from '@fridgeweek/core';
import { computed, ref, useId } from 'vue';
import { t } from '../../i18n/index.js';
import MarkPicker from './MarkPicker.vue';

const props = defineProps<{
  person: Person;
  position: number;
  /** Everyone else on the sheet: a mark one of them has can then say who. */
  others: Person[];
  locale: string;
  canRemove: boolean;
  /** Only one person's mark panel is open at a time, so the list stays short. */
  open: boolean;
  /** Asking whether this person should really go. Mutually exclusive with `open`. */
  confirming: boolean;
  /** Ordering is only a choice once there is more than one person. */
  canReorder: boolean;
  /** This row is the one being dragged, so it steps back while it travels. */
  dragging: boolean;
  /** Which side of this row the dragged person would land on, if any. */
  dropEdge: 'above' | 'below' | null;
}>();

const emit = defineEmits<{
  update: [change: Partial<Person>];
  remove: [];
  askRemove: [];
  cancelRemove: [];
  toggle: [];
  /** One step up (-1) or down (1), from the keyboard. */
  move: [delta: number];
  dragStart: [];
  dragOver: [];
  drop: [];
  dragEnd: [];
}>();

const nameId = useId();
const confirmId = useId();
const handleEl = ref<HTMLButtonElement | null>(null);
const confirmEl = ref<HTMLButtonElement | null>(null);

/** Falls back to the position when the name is still empty, so labels are never blank. */
const displayName = computed(
  () => props.person.name.trim() || t('people.nameLabel', { position: props.position }),
);

function onName(event: Event): void {
  emit('update', { name: (event.target as HTMLInputElement).value });
}

/**
 * The handle is what is draggable, not the row: a draggable row swallows the
 * text selection in the name field, and a drag that can only start on the grip
 * is the one the grip advertises. The ghost is still the whole row, so what
 * travels under the pointer is the person and not a six-dot icon.
 */
function onDragStart(event: DragEvent): void {
  const row = (event.currentTarget as HTMLElement).closest('.person');
  if (event.dataTransfer) {
    event.dataTransfer.effectAllowed = 'move';
    // Firefox starts no drag at all without payload, and the position is the
    // only thing about this row worth carrying.
    event.dataTransfer.setData('text/plain', String(props.position));
    if (row instanceof HTMLElement) {
      event.dataTransfer.setDragImage(row, 16, row.offsetHeight / 2);
    }
  }
  emit('dragStart');
}

function onDragOver(event: DragEvent): void {
  // Without this the browser refuses the drop and animates the row back.
  event.preventDefault();
  if (event.dataTransfer) event.dataTransfer.dropEffect = 'move';
  emit('dragOver');
}

/** Exposed so the list can keep focus on the handle after a keyboard move. */
function focusHandle(): void {
  handleEl.value?.focus();
}

/** Exposed for the same reason: the question should be where the keyboard is. */
function focusConfirm(): void {
  confirmEl.value?.focus();
}

defineExpose({ focusHandle, focusConfirm });
</script>

<template>
  <li
    class="person"
    :class="{
      open,
      confirming,
      dragging,
      'drop-above': dropEdge === 'above',
      'drop-below': dropEdge === 'below',
    }"
    @dragover="onDragOver"
    @drop.prevent="emit('drop')"
  >
    <div class="row">
      <!--
        A handle rather than a whole draggable row, and a button rather than a
        decoration: the arrow keys move a person for anyone not holding a mouse,
        which is the only way this is reorderable without one.
      -->
      <button
        v-if="canReorder"
        ref="handleEl"
        type="button"
        class="grip"
        draggable="true"
        :aria-label="t('people.reorderLabel', { name: displayName })"
        @dragstart="onDragStart"
        @dragend="emit('dragEnd')"
        @keydown.up.prevent="emit('move', -1)"
        @keydown.down.prevent="emit('move', 1)"
      >
        <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
          <circle cx="9" cy="5" r="1.6" />
          <circle cx="9" cy="12" r="1.6" />
          <circle cx="9" cy="19" r="1.6" />
          <circle cx="15" cy="5" r="1.6" />
          <circle cx="15" cy="12" r="1.6" />
          <circle cx="15" cy="19" r="1.6" />
        </svg>
      </button>
      <span v-else class="grip-spacer" />

      <MarkPicker
        :symbol="person.symbol"
        :initial="person.initial"
        :suggested-initial="personInitial(person)"
        :others="others"
        :locale="locale"
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
        :aria-expanded="confirming"
        :aria-controls="confirmId"
        @click="emit('askRemove')"
      >
        <!-- Drawn rather than typed: a multiplication sign sits on the maths
             axis, not in the middle of the box, and the hover square showed it. -->
        <svg
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          stroke-width="2.2"
          stroke-linecap="round"
          aria-hidden="true"
        >
          <path d="M18 6 6 18M6 6l12 12" />
        </svg>
      </button>
      <span v-else class="remove-spacer" />
    </div>

    <!--
      Removing somebody takes their name, their mark and their place in the
      order with it, and the button that does it sits where the button that
      closes the mark panel wants to be. So it asks first, in the row itself.
    -->
    <div
      v-if="confirming"
      :id="confirmId"
      class="confirm"
      role="group"
      :aria-label="t('people.removeQuestion', { name: displayName })"
      @keydown.esc.stop="emit('cancelRemove')"
    >
      <p class="confirm-question">{{ t('people.removeQuestion', { name: displayName }) }}</p>
      <div class="confirm-actions">
        <button type="button" class="keep" @click="emit('cancelRemove')">
          {{ t('people.removeCancel') }}
        </button>
        <button ref="confirmEl" type="button" class="danger" @click="emit('remove')">
          {{ t('people.removeConfirm') }}
        </button>
      </div>
    </div>
  </li>
</template>

<style scoped>
/*
 * A person is a bordered row. Opening the mark panel turns the row into a card
 * in the accent colour, so it is obvious which person is being changed.
 */
.person {
  position: relative;
  list-style: none;
  padding: 6px 8px 6px 4px;
  background: var(--white);
  border: 1px solid var(--border);
  border-radius: var(--radius-md);
}

.person.open,
.person.confirming {
  padding: 12px;
  border: 2px solid var(--accent-mid);
}

.person.confirming {
  border-color: var(--accent);
}

/* Travelling, not gone: the row stays in place, greyed, until it is dropped. */
.person.dragging {
  opacity: 0.4;
}

/*
 * Where it would land, drawn in the gap between rows rather than on a row, so
 * that "after the last one" has somewhere to be shown.
 */
.person.drop-above::before,
.person.drop-below::after {
  content: '';
  position: absolute;
  left: 0;
  right: 0;
  height: 3px;
  border-radius: var(--radius-pill);
  background: var(--accent);
}

.person.drop-above::before {
  top: -6px;
}

.person.drop-below::after {
  bottom: -6px;
}

.row {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 8px;
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

.grip,
.grip-spacer {
  width: 20px;
  height: 28px;
  flex: none;
}

.grip {
  display: grid;
  place-items: center;
  padding: 0;
  border: none;
  border-radius: var(--radius-sm);
  background: transparent;
  color: var(--rule);
  cursor: grab;
}

.grip:active {
  cursor: grabbing;
}

.grip svg {
  width: 16px;
  height: 16px;
}

.person:hover .grip,
.grip:focus-visible {
  color: var(--ink-faint);
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
  padding: 0;
  border: none;
  border-radius: var(--radius-sm);
  background: transparent;
  color: var(--ink-faint);
  cursor: pointer;
}

.remove svg {
  width: 15px;
  height: 15px;
}

.remove:hover {
  background: var(--paper-tint);
  color: var(--accent);
}

/* Beside the mark panel in the same row, and laid out the same way. */
.confirm {
  order: 99;
  width: 100%;
  margin-top: 10px;
}

.confirm-question {
  font-size: 14px;
  line-height: 1.4;
  color: var(--ink);
}

.confirm-actions {
  display: flex;
  justify-content: flex-end;
  gap: var(--space-2);
  margin-top: var(--space-3);
}

.keep,
.danger {
  padding: 7px 16px;
  border-radius: var(--radius-sm);
  font: inherit;
  font-size: 14px;
  font-weight: 700;
  cursor: pointer;
}

.keep {
  border: 1px solid var(--border);
  background: var(--white);
  color: var(--ink);
}

.keep:hover {
  border-color: var(--accent-mid);
  color: var(--accent);
}

.danger {
  border: 1px solid var(--accent);
  background: var(--accent);
  color: var(--paper);
}

.danger:hover {
  border-color: var(--accent-deep);
  background: var(--accent-deep);
}
</style>
