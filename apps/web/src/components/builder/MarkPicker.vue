<script setup lang="ts">
import { type Person, SYMBOL_IDS, type SymbolId, symbolLabel } from '@fridgeweek/core';
import { computed, nextTick, ref, useId, watch } from 'vue';
import { t } from '../../i18n/index.js';
import SegmentedControl from './SegmentedControl.vue';
import SymbolMark from './SymbolMark.vue';

/**
 * One person's mark, which is either a symbol or their initials. Both are the
 * same choice, so both live in the same panel; the switch at the top is what
 * makes that choice visible. Before it, a picture and a text field sat side by
 * side silently cancelling each other, and typing letters was a hidden way of
 * turning a picture off.
 *
 * Nothing new is stored: `initial` set or not is still the whole model.
 */
type MarkMode = 'picture' | 'letters';

const props = defineProps<{
  /** Kept whether or not it is what gets drawn, so letters can be undone. */
  symbol: SymbolId;
  /** Set when this person is drawn as letters instead of their symbol. */
  initial: string | undefined;
  /** The letters they would get, shown as the placeholder until they type. */
  suggestedInitial: string;
  /** The other people on the sheet, so a mark one of them has can say who. */
  others: Person[];
  /** Drives the case of an initial, the way the engine's own check does. */
  locale: string;
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
const gridEl = ref<HTMLUListElement | null>(null);
const initialsInput = ref<HTMLInputElement | null>(null);
const panelId = useId();
const initialsId = useId();

const mode = ref<MarkMode>('picture');
/** Which option the arrow keys are on, so the grid is one tab stop. */
const roving = ref<SymbolId | null>(null);
/**
 * Why the last thing you tried is not what the sheet shows. It is said here,
 * beside the control, rather than left for the engine to phrase in a path.
 */
const refusal = ref('');

const usesInitial = computed(() => props.initial !== undefined);

const modeOptions = computed(() => [
  { value: 'picture' as const, label: t('people.markPicture') },
  { value: 'letters' as const, label: t('people.markLetters') },
]);

/** `SegmentedControl` writes a value; choosing a mode has to do more than that. */
const markMode = computed<MarkMode>({
  get: () => mode.value,
  set: (next) => applyMode(next),
});

const matches = computed(() => {
  const needle = query.value.trim().toLowerCase();
  if (!needle) return SYMBOL_IDS;
  return SYMBOL_IDS.filter(
    (id) => id.includes(needle) || symbolLabel(id).toLowerCase().includes(needle),
  );
});

/** The option the grid's single tab stop sits on: where you left it, else your own. */
const rovingId = computed<SymbolId | undefined>(() => {
  const list = matches.value;
  if (roving.value !== null && list.includes(roving.value)) return roving.value;
  if (!usesInitial.value && list.includes(props.symbol)) return props.symbol;
  return list[0];
});

function symbolOwner(id: SymbolId): Person | undefined {
  return props.others.find((person) => person.symbol === id);
}

/**
 * Initials only have to be distinct among the people actually drawn as
 * letters, which is the engine's rule; the symbol behind a person drawn as
 * letters is somebody's mark either way, hence the two separate checks.
 */
function initialOwner(letters: string): Person | undefined {
  const needle = letters.trim().toLocaleUpperCase(props.locale);
  if (!needle) return undefined;
  return props.others.find(
    (person) =>
      person.initial !== undefined && person.initial.toLocaleUpperCase(props.locale) === needle,
  );
}

function applyMode(next: MarkMode): void {
  mode.value = next;
  refusal.value = '';

  if (next === 'picture') {
    if (usesInitial.value) emit('update', { initial: undefined });
    nextTick(() => focusSymbol(props.symbol));
    return;
  }

  // Switching to letters gives them the ones their name suggests, so the
  // choice takes effect where it is made rather than waiting on a keystroke.
  if (!usesInitial.value) {
    const owner = initialOwner(props.suggestedInitial);
    if (owner) {
      refusal.value = takenInitial(owner, props.suggestedInitial);
    } else {
      emit('update', { initial: props.suggestedInitial });
    }
  }
  nextTick(() => initialsInput.value?.focus());
}

function choose(id: SymbolId): void {
  const owner = symbolOwner(id);
  if (owner) {
    // Dimming it and refusing the click says nothing. Say who has it.
    refusal.value = t('people.symbolTaken', {
      name: owner.name,
      symbol: symbolLabel(id).toLowerCase(),
    });
    return;
  }
  refusal.value = '';
  roving.value = id;
  emit('update', { symbol: id, initial: undefined });
}

function onInitials(event: Event): void {
  const value = (event.target as HTMLInputElement).value.trim();
  const owner = initialOwner(value);
  if (owner) {
    refusal.value = takenInitial(owner, value);
    return;
  }
  refusal.value = '';
  emit('update', { initial: value === '' ? undefined : value });
}

/**
 * A refused draft is fine while you are still typing on it, and a lie once you
 * have left: the value bound to the field never changed, so Vue has nothing to
 * put back. Restoring it here is what `StepperInput` does after a clamp, and
 * the message stays to say why the letters went.
 */
function syncInitials(event: FocusEvent): void {
  const input = event.target as HTMLInputElement;
  const value = props.initial ?? '';
  if (input.value !== value) input.value = value;
}

function takenInitial(owner: Person, letters: string): string {
  return t('people.initialTaken', {
    name: owner.name,
    letters: letters.trim().toLocaleUpperCase(props.locale),
  });
}

function focusSymbol(id: SymbolId): void {
  gridEl.value?.querySelector<HTMLButtonElement>(`[data-symbol="${id}"]`)?.focus();
}

/** However many the panel's width fits, so the arrows follow what is drawn. */
function columnCount(): number {
  if (!gridEl.value) return 1;
  return getComputedStyle(gridEl.value).gridTemplateColumns.split(' ').filter(Boolean).length;
}

function onGridKey(event: KeyboardEvent, id: SymbolId): void {
  const list = matches.value;
  const at = list.indexOf(id);
  if (at < 0) return;

  let next: number;
  if (event.key === 'Home') next = 0;
  else if (event.key === 'End') next = list.length - 1;
  else {
    const columns = columnCount();
    const step = { ArrowRight: 1, ArrowLeft: -1, ArrowDown: columns, ArrowUp: -columns }[event.key];
    if (step === undefined) return;
    next = at + step;
  }

  event.preventDefault();
  const target = list[Math.min(list.length - 1, Math.max(0, next))];
  if (target === undefined) return;
  roving.value = target;
  nextTick(() => focusSymbol(target));
}

watch(
  () => props.open,
  async (isOpen) => {
    query.value = '';
    refusal.value = '';
    if (!isOpen) return;

    mode.value = usesInitial.value ? 'letters' : 'picture';
    roving.value = null;
    await nextTick();
    // The mark you already have, not the search box: nothing gets typed by
    // accident, and a phone keeps its keyboard down until it is asked for.
    if (mode.value === 'letters') initialsInput.value?.focus();
    else focusSymbol(props.symbol);
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
    <!-- The mark is a button; on its own it does not look like one. -->
    <svg
      class="caret"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      stroke-width="2.5"
      stroke-linecap="round"
      stroke-linejoin="round"
      aria-hidden="true"
    >
      <path d="m6 9 6 6 6-6" />
    </svg>
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
    <SegmentedControl
      v-model="markMode"
      :label="t('people.markPickerTitle')"
      :options="modeOptions"
    >
      <!-- Each option carries the mark it would give, so the one you are not
           using stays visible and switching back is a preview, not a gamble. -->
      <template #option="{ option }">
        <span class="chip">
          <SymbolMark v-if="option.value === 'picture'" :id="symbol" :size="16" />
          <template v-else>{{ initial ?? suggestedInitial }}</template>
        </span>
        {{ option.label }}
      </template>
    </SegmentedControl>

    <template v-if="markMode === 'picture'">
      <input
        v-model="query"
        type="search"
        class="search"
        :placeholder="t('people.symbolSearch')"
        :aria-label="t('people.symbolSearch')"
      />
      <p v-if="matches.length === 0" class="empty">{{ t('people.symbolNoResults') }}</p>
      <ul v-else ref="gridEl" class="grid">
        <li v-for="id in matches" :key="id">
          <button
            type="button"
            class="option"
            :class="{ selected: id === symbol && !usesInitial, taken: symbolOwner(id) }"
            :data-symbol="id"
            :tabindex="id === rovingId ? 0 : -1"
            :aria-pressed="id === symbol && !usesInitial"
            :aria-label="
              symbolOwner(id)
                ? t('people.symbolTaken', {
                    name: symbolOwner(id)?.name ?? '',
                    symbol: symbolLabel(id).toLowerCase(),
                  })
                : symbolLabel(id)
            "
            @click="choose(id)"
            @keydown="onGridKey($event, id)"
          >
            <SymbolMark :id="id" :size="20" />
          </button>
        </li>
      </ul>
    </template>

    <input
      v-else
      :id="initialsId"
      ref="initialsInput"
      class="initials-input"
      type="text"
      maxlength="2"
      :value="initial ?? ''"
      :placeholder="suggestedInitial"
      :aria-label="initialsLabel"
      :aria-invalid="refusal ? 'true' : undefined"
      :class="{ invalid: refusal }"
      @input="onInitials"
      @blur="syncInitials"
    />

    <p class="refusal" role="status">{{ refusal }}</p>

    <div class="panel-foot">
      <button type="button" class="done" @click="emit('toggle')">
        {{ t('people.markDone') }}
      </button>
    </div>
  </div>
</template>

<style scoped>
.trigger {
  display: flex;
  align-items: center;
  gap: 3px;
  height: 34px;
  flex: none;
  padding: 0 5px 0 7px;
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
  width: 20px;
  font: 700 15px/1 var(--font-mono);
  text-align: center;
}

.caret {
  width: 12px;
  height: 12px;
  color: var(--ink-faint);
}

.trigger:hover .caret,
.trigger[aria-expanded='true'] .caret {
  color: var(--accent);
}

.mark-panel {
  order: 99;
  width: 100%;
  margin-top: 10px;
}

/* The mark each option would give, drawn at the size it is drawn everywhere. */
.chip {
  display: grid;
  place-items: center;
  width: 22px;
  height: 22px;
  border-radius: 4px;
  background: var(--paper-sunk);
  font: 700 12px/1 var(--font-mono);
  color: var(--ink-soft);
}

.mark-panel :deep(.segment[aria-checked='true']) .chip {
  background: var(--paper-tint);
  color: var(--accent);
}

.search {
  width: 100%;
  height: 32px;
  margin: var(--space-3) 0 var(--space-2);
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

.option:hover:not(.taken) {
  background: var(--paper-tint);
  color: var(--ink);
}

.option.selected {
  border-color: var(--accent);
  background: var(--paper-tint);
  color: var(--accent);
}

/*
 * Dimmed, because it is not yours to take, but still reachable and still
 * clickable: it has something to say about who has it.
 */
.option.taken {
  opacity: 0.4;
}

.option.taken:hover {
  background: var(--paper-sunk);
}

.initials-input {
  width: 64px;
  height: 38px;
  margin-top: var(--space-3);
  padding: 0 8px;
  border: 1px solid var(--rule);
  border-radius: var(--radius-sm);
  background: var(--white);
  font: 500 16px/1 var(--font-mono);
  text-align: center;
  color: var(--ink);
}

.initials-input:focus {
  border-color: var(--accent-mid);
}

.initials-input.invalid {
  border-color: var(--accent);
}

.refusal {
  margin-top: var(--space-2);
  font-size: 13px;
  line-height: 1.4;
  color: var(--accent);
}

.refusal:empty {
  display: none;
}

.empty {
  padding: var(--space-3) var(--space-1);
  font-size: 14px;
  color: var(--ink-faint);
}

.panel-foot {
  display: flex;
  justify-content: flex-end;
  margin-top: var(--space-3);
}

.done {
  padding: 7px 16px;
  border: 1px solid var(--border);
  border-radius: var(--radius-sm);
  background: var(--white);
  font: inherit;
  font-size: 14px;
  font-weight: 700;
  color: var(--ink);
  cursor: pointer;
}

.done:hover {
  border-color: var(--accent-mid);
  color: var(--accent);
}
</style>
