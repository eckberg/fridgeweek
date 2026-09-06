<script setup lang="ts">
import {
  LIMITS,
  type MarkStyle,
  type PaperSize,
  SYMBOL_IDS,
  type WeekendStyle,
} from '@fridgeweek/core';
import { computed, onMounted, onUnmounted, ref, useId } from 'vue';
import '../../i18n/catalogues.js';
import { localeMeta, type MessageKey, translator, UI_LOCALES } from '../../i18n/index.js';
import { downloadHtml, downloadPdf, printDocument, sheetFilename } from '../../lib/output.js';
import ControlGroup from './ControlGroup.vue';
import FieldRow from './FieldRow.vue';
import FitStatus from './FitStatus.vue';
import PersonRow from './PersonRow.vue';
import RangeSlider from './RangeSlider.vue';
import SegmentedControl from './SegmentedControl.vue';
import SheetPreview from './SheetPreview.vue';
import StepperInput from './StepperInput.vue';
import ToggleSwitch from './ToggleSwitch.vue';
import { useSheet } from './useSheet.js';

const sheet = useSheet();
const { config, layout, previewSvg, fit } = sheet;

const t = computed(() => translator(config.value.locale));
const tr = (key: MessageKey, params?: Record<string, string | number>) => t.value(key, params);

const marginId = useId();
const copiesId = useId();
const languageId = useId();
const weekStartingId = useId();

/** Announces the result of an action to assistive technology and to everyone else. */
const notice = ref('');
const busy = ref(false);

function announce(message: string): void {
  notice.value = message;
  window.setTimeout(() => {
    if (notice.value === message) notice.value = '';
  }, 4000);
}

// --- Controls bound straight to the configuration -------------------------

function field<K extends keyof typeof config.value>(key: K) {
  return computed({
    get: () => config.value[key],
    set: (value) => sheet.update({ [key]: value } as never),
  });
}

const locale = field('locale');
const paper = field('paper');
const marginMm = field('marginMm');
const copies = field('copies');
const linesPerDay = field('linesPerDay');
const markStyle = field('markStyle');
const weekendStyle = field('weekendStyle');
const familyMark = field('familyMark');
const showDateRange = field('showDateRange');
const showDayDates = field('showDayDates');
const showLegend = field('showLegend');

/** `showWeekNumber` is a tri-state in the config but a switch on screen. */
const showWeekNumber = computed({
  get: () =>
    config.value.showWeekNumber === 'auto'
      ? layout.value.header?.weekBox !== undefined
      : config.value.showWeekNumber,
  set: (value: boolean) => sheet.update({ showWeekNumber: value }),
});

const weekStarting = computed({
  get: () => config.value.weekStarting ?? '',
  set: (value: string) => {
    if (value) sheet.update({ weekStarting: value });
    else sheet.clearWeekStarting();
  },
});

// --- People ---------------------------------------------------------------

const takenSymbols = computed(() => config.value.people.map((person) => person.symbol));
const canAddPerson = computed(() => config.value.people.length < LIMITS.people.max);
const canRemovePerson = computed(() => config.value.people.length > LIMITS.people.min);

const NEW_PERSON_NAMES = ['Robin', 'Mika', 'Noa', 'Alex', 'Sam', 'Kim'];

function addPerson(): void {
  const used = new Set(takenSymbols.value);
  const symbol = SYMBOL_IDS.find((id) => !used.has(id));
  if (!symbol) return;
  const names = new Set(config.value.people.map((p) => p.name));
  const name = NEW_PERSON_NAMES.find((candidate) => !names.has(candidate)) ?? '';
  sheet.addPerson({ name, symbol });
}

// --- Dates ----------------------------------------------------------------

/**
 * The engine snaps a chosen date back to the first weekday of the locale. Say
 * so, rather than silently moving what someone typed.
 */
const snapNotice = computed(() => {
  const chosen = config.value.weekStarting;
  const start = layout.value ? sheet.config.value.weekStarting : undefined;
  if (!chosen || !start) return null;
  const days = sheet.layout.value.days;
  const first = days[0]?.dateField?.text;
  if (!first || first === chosen) return null;
  const weekday = days[0]?.name.text ?? '';
  return tr('header.snapped', {
    weekday: weekday.charAt(0) + weekday.slice(1).toLowerCase(),
    language: localeMeta(config.value.locale).endonym,
  });
});

// --- Output ---------------------------------------------------------------

async function onPrint(): Promise<void> {
  busy.value = true;
  try {
    await printDocument(sheet.printableHtml());
  } catch {
    announce(tr('pdf.failed'));
  } finally {
    busy.value = false;
  }
}

async function onPdf(): Promise<void> {
  busy.value = true;
  announce(tr('pdf.preparing'));
  const result = await downloadPdf(config.value, sheetFilename('pdf', config.value.weekStarting));
  busy.value = false;
  if (!result.ok) {
    announce(result.reason === 'unavailable' ? tr('pdf.unavailable') : tr('pdf.failed'));
  } else {
    notice.value = '';
  }
}

function onDownloadHtml(): void {
  downloadHtml(sheet.printableHtml(), sheetFilename('html', config.value.weekStarting));
}

async function onCopyLink(): Promise<void> {
  try {
    await navigator.clipboard.writeText(sheet.link());
    announce(tr('action.copied'));
  } catch {
    // Clipboard access can be refused; the address bar already holds the link.
  }
}

// The address bar is part of the state, so a paste or a back button must land.
onMounted(() => window.addEventListener('hashchange', sheet.adoptHash));
onUnmounted(() => window.removeEventListener('hashchange', sheet.adoptHash));

const languageSummary = computed(() => {
  const meta = localeMeta(config.value.locale);
  const first = layout.value.days[0]?.name.text ?? '';
  return `${config.value.locale} · ${first}`;
});
</script>

<template>
  <div class="builder">
    <form class="panel" :aria-label="tr('builder.settingsLabel')" @submit.prevent>
      <div class="actions">
        <button type="button" class="primary" :disabled="busy" @click="onPdf">
          {{ tr('action.downloadPdf') }}
        </button>
        <button type="button" class="secondary" :disabled="busy" @click="onPrint">
          {{ tr('action.print') }}
        </button>
      </div>

      <p v-if="notice" class="notice" role="status">{{ notice }}</p>
      <p v-else class="visually-hidden" role="status" />

      <ControlGroup
        :title="tr('language.group')"
        :meta="tr('language.available', { count: UI_LOCALES.length })"
      >
        <FieldRow :label="tr('language.label')" :control-id="languageId" stacked>
          <select :id="languageId" v-model="locale" class="select">
            <option v-for="option in UI_LOCALES" :key="option.code" :value="option.code">
              {{ option.endonym }}
            </option>
          </select>
        </FieldRow>
        <p class="mono summary">{{ languageSummary }}</p>
      </ControlGroup>

      <ControlGroup
        :title="tr('people.group')"
        :meta="tr('people.count', { count: config.people.length, max: LIMITS.people.max })"
      >
        <ul class="people">
          <PersonRow
            v-for="(person, index) in config.people"
            :key="index"
            :person="person"
            :position="index + 1"
            :taken="takenSymbols"
            :can-remove="canRemovePerson"
            :locale="config.locale"
            :t="tr"
            @update="(change) => sheet.updatePerson(index, change)"
            @remove="sheet.removePerson(index)"
          />
        </ul>

        <button v-if="canAddPerson" type="button" class="add" @click="addPerson">
          <span aria-hidden="true">+</span> {{ tr('people.add') }}
        </button>

        <FieldRow :label="tr('people.familyMark')" :help="tr('people.familyMarkHelp')">
          <ToggleSwitch v-model="familyMark" :label="tr('people.familyMark')" />
        </FieldRow>

        <FieldRow :label="tr('people.markStyle')" stacked>
          <SegmentedControl
            v-model="markStyle as MarkStyle"
            :label="tr('people.markStyle')"
            :options="[
              { value: 'symbol', label: tr('people.markStyle.symbol') },
              { value: 'initial', label: tr('people.markStyle.initial') },
            ]"
          />
        </FieldRow>
      </ControlGroup>

      <ControlGroup :title="tr('days.group')">
        <FieldRow
          :label="tr('days.linesPerDay')"
          :value="tr('days.linesEach', { height: layout.metrics.lineHeight })"
          stacked
        >
          <SegmentedControl
            v-model="linesPerDay"
            :label="tr('days.linesPerDay')"
            :options="[
              { value: 1, label: '1' },
              { value: 2, label: '2' },
              { value: 3, label: '3' },
              { value: 4, label: '4' },
            ]"
          />
        </FieldRow>

        <FieldRow :label="tr('days.weekendNames')" stacked>
          <SegmentedControl
            v-model="weekendStyle as WeekendStyle"
            :label="tr('days.weekendNames')"
            :options="[
              { value: 'outline', label: tr('days.weekend.outline') },
              { value: 'plain', label: tr('days.weekend.plain') },
            ]"
          />
        </FieldRow>
      </ControlGroup>

      <ControlGroup :title="tr('header.group')">
        <FieldRow
          :label="tr('header.weekStarting')"
          :help="snapNotice ?? tr('header.undated')"
          :control-id="weekStartingId"
          stacked
        >
          <input :id="weekStartingId" v-model="weekStarting" type="date" class="date" />
        </FieldRow>

        <FieldRow :label="tr('header.weekNumber')">
          <ToggleSwitch v-model="showWeekNumber" :label="tr('header.weekNumber')" />
        </FieldRow>
        <FieldRow :label="tr('header.dateRange')">
          <ToggleSwitch v-model="showDateRange" :label="tr('header.dateRange')" />
        </FieldRow>
        <FieldRow :label="tr('header.dayDates')">
          <ToggleSwitch v-model="showDayDates" :label="tr('header.dayDates')" />
        </FieldRow>
        <FieldRow :label="tr('header.legend')">
          <ToggleSwitch v-model="showLegend" :label="tr('header.legend')" />
        </FieldRow>
      </ControlGroup>

      <ControlGroup :title="tr('paper.group')">
        <FieldRow :label="tr('paper.size')" stacked>
          <SegmentedControl
            v-model="paper as PaperSize"
            :label="tr('paper.size')"
            :options="[
              { value: 'A4', label: tr('paper.a4') },
              { value: 'Letter', label: tr('paper.letter') },
            ]"
          />
        </FieldRow>

        <FieldRow
          :label="tr('paper.margin')"
          :value="`${config.marginMm} ${tr('paper.marginUnit')}`"
          :control-id="marginId"
          stacked
        >
          <RangeSlider
            :id="marginId"
            v-model="marginMm"
            :min="LIMITS.marginMm.min"
            :max="LIMITS.marginMm.max"
            :label="tr('paper.margin')"
          />
        </FieldRow>

        <FieldRow :label="tr('paper.copies')" :help="tr('paper.copiesHelp')" :control-id="copiesId">
          <StepperInput
            :id="copiesId"
            v-model="copies"
            :min="LIMITS.copies.min"
            :max="LIMITS.copies.max"
            :label="tr('paper.copies')"
            :decrease-label="tr('paper.decrease')"
            :increase-label="tr('paper.increase')"
          />
        </FieldRow>
      </ControlGroup>

      <FitStatus :layout="layout" :fit="fit" :t="tr" />

      <div class="panel-foot">
        <button type="button" class="ghost" @click="onCopyLink">{{ tr('action.copyLink') }}</button>
        <button type="button" class="ghost" @click="onDownloadHtml">
          {{ tr('action.downloadHtml') }}
        </button>
        <p class="mono foot-note">{{ tr('builder.urlNote') }}<br />{{ tr('builder.privacyNote') }}</p>
      </div>
    </form>

    <div class="preview" :aria-label="tr('builder.previewLabel')" role="region">
      <SheetPreview :svg="previewSvg" :t="tr" />
    </div>
  </div>
</template>

<style scoped>
.builder {
  display: grid;
  grid-template-columns: var(--panel-width) 1fr;
  height: 100%;
  min-height: 0;
}

.panel {
  /* A grid item defaults to its content's minimum width, which a stepper or a
     segmented control can push past a narrow viewport. */
  min-width: 0;
  overflow-y: auto;
  border-right: 1px solid var(--border);
  background: var(--paper);
}

.preview {
  min-width: 0;
  height: 100%;
}

.actions {
  display: flex;
  gap: var(--space-2);
  padding: var(--space-4) var(--space-5);
  border-bottom: 1px solid var(--border);
  position: sticky;
  top: 0;
  z-index: 5;
  background: var(--paper);
}

.actions button {
  flex: 1;
  height: 40px;
  border-radius: var(--radius-md);
  font-size: 15px;
  font-weight: 700;
  cursor: pointer;
  border: 1px solid transparent;
}

.actions button:disabled {
  opacity: 0.55;
  cursor: default;
}

.primary {
  background: var(--accent);
  color: var(--paper);
}

.primary:hover:not(:disabled) {
  background: var(--ink);
}

.secondary {
  background: var(--white);
  border-color: var(--border);
  color: var(--ink);
}

.secondary:hover:not(:disabled) {
  border-color: var(--accent-mid);
  color: var(--accent);
}

.notice {
  margin: 0;
  padding: var(--space-3) var(--space-5);
  background: var(--paper-tint);
  font-size: 14px;
  color: var(--ink-soft);
}

.people {
  display: flex;
  flex-direction: column;
  gap: var(--space-2);
  list-style: none;
}

.add {
  align-self: flex-start;
  padding: var(--space-2) var(--space-3);
  border: 1px dashed var(--border);
  border-radius: var(--radius-md);
  background: transparent;
  font-size: 14px;
  font-weight: 700;
  color: var(--ink-soft);
  cursor: pointer;
}

.add:hover {
  border-color: var(--accent-mid);
  border-style: solid;
  color: var(--accent);
}

.select,
.date {
  width: 100%;
  height: 38px;
  padding: 0 var(--space-3);
  border: 1px solid var(--border);
  border-radius: var(--radius-md);
  background: var(--white);
  font: inherit;
  font-size: 15px;
  color: var(--ink);
}

.summary {
  font-size: 11px;
  text-transform: uppercase;
  letter-spacing: 0.08em;
}

.panel-foot {
  display: flex;
  flex-wrap: wrap;
  gap: var(--space-2);
  padding: var(--space-4) var(--space-5) var(--space-6);
}

.ghost {
  padding: var(--space-2) var(--space-3);
  border: 1px solid var(--border);
  border-radius: var(--radius-md);
  background: transparent;
  font-size: 14px;
  cursor: pointer;
}

.ghost:hover {
  border-color: var(--accent-mid);
  color: var(--accent);
}

.foot-note {
  flex-basis: 100%;
  margin-top: var(--space-2);
  font-size: 11px;
  line-height: 1.6;
}

@media (max-width: 900px) {
  .builder {
    grid-template-columns: 1fr;
    grid-template-rows: auto 1fr;
    height: auto;
  }

  .panel {
    border-right: none;
    border-bottom: 1px solid var(--border);
    overflow: visible;
  }

  .preview {
    min-height: 70vh;
  }
}
</style>
