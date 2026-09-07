<script setup lang="ts">
import {
  LIMITS,
  SHEET_LOCALES,
  type SheetConfig,
  SYMBOL_IDS,
  sheetLocaleMeta,
} from '@fridgeweek/core';
import { computed, onMounted, onUnmounted, ref, useId } from 'vue';
import { t } from '../../i18n/index.js';
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
const { config, layout, previewSvg, fit, rejected, linkWasBroken } = sheet;

const marginId = useId();
const copiesId = useId();
const languageId = useId();
const weekStartingId = useId();

/** Announces the result of an action to assistive technology and to everyone else. */
const notice = ref('');
const busy = ref(false);
/** Index of the person whose symbol grid is open, or null. */
const openPerson = ref<number | null>(null);

function togglePerson(index: number): void {
  openPerson.value = openPerson.value === index ? null : index;
}

function announce(message: string): void {
  notice.value = message;
  window.setTimeout(() => {
    if (notice.value === message) notice.value = '';
  }, 4000);
}

// --- Controls bound straight to the configuration -------------------------

/** Two-way binding for one configuration field, validated on the way in. */
function field<K extends keyof SheetConfig>(key: K) {
  return computed<SheetConfig[K]>({
    get: () => config.value[key],
    set: (value) => sheet.update({ [key]: value } as Pick<SheetConfig, K>),
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

function dismissLinkWarning(): void {
  linkWasBroken.value = false;
}

function removePerson(index: number): void {
  openPerson.value = null;
  sheet.removePerson(index);
}

function addPerson(): void {
  openPerson.value = null;
  const used = new Set(takenSymbols.value);
  const symbol = SYMBOL_IDS.find((id) => !used.has(id));
  if (!symbol) return;
  const names = new Set(config.value.people.map((p) => p.name));
  const name = NEW_PERSON_NAMES.find((candidate) => !names.has(candidate)) ?? '';
  sheet.addPerson({ name, symbol });
}

// --- Dates ----------------------------------------------------------------

/**
 * The engine snaps a chosen date back to the first weekday of the locale, so
 * that a sheet always starts where that language starts its week. Say so,
 * rather than silently moving what someone typed.
 */
const snapNotice = computed(() => {
  const chosen = config.value.weekStarting;
  if (!chosen) return null;

  const firstDay = layout.value.days[0];
  const printed = firstDay?.dateField?.text;
  if (!printed || printed === chosen) return null;

  const weekday = firstDay?.name.text ?? '';
  return t('header.snapped', {
    weekday: weekday.charAt(0) + weekday.slice(1).toLocaleLowerCase(config.value.locale),
    language: sheetLocaleMeta(config.value.locale).endonym,
  });
});

// --- Output ---------------------------------------------------------------

async function onPrint(): Promise<void> {
  busy.value = true;
  try {
    await printDocument(sheet.printableHtml());
  } catch {
    announce(t('pdf.failed'));
  } finally {
    busy.value = false;
  }
}

async function onPdf(): Promise<void> {
  busy.value = true;
  announce(t('pdf.preparing'));
  const result = await downloadPdf(config.value, sheetFilename('pdf', config.value.weekStarting));
  busy.value = false;
  if (!result.ok) {
    announce(result.reason === 'unavailable' ? t('pdf.unavailable') : t('pdf.failed'));
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
    announce(t('action.copied'));
  } catch {
    // Clipboard access can be refused; the address bar already holds the link.
  }
}

// The address bar is part of the state, so a paste or a back button must land.
onMounted(() => window.addEventListener('hashchange', sheet.adoptHash));
onUnmounted(() => window.removeEventListener('hashchange', sheet.adoptHash));

/**
 * One line of feedback, most urgent first: a change the engine refused, then a
 * link that could not be read, then whatever an action last reported.
 */
const message = computed(() => {
  const refusal = rejected.value[0];
  if (refusal) return refusal.message;
  if (linkWasBroken.value) return t('error.invalidLink');
  return notice.value;
});

const languageSummary = computed(() => {
  const meta = sheetLocaleMeta(config.value.locale);
  const first = layout.value.days[0]?.name.text ?? '';
  return `${config.value.locale} · ${first}`;
});
</script>

<template>
  <div class="builder">
    <Teleport to="#builder-actions" defer>
      <button type="button" class="header-button secondary" :disabled="busy" @click="onPrint">
        {{ t('action.print') }}
      </button>
      <button type="button" class="header-button primary" :disabled="busy" @click="onPdf">
        {{ t('action.downloadPdf') }}
      </button>
    </Teleport>

    <!-- One live region that always exists: swapping the element out would
         insert the text with its container and typically go unannounced. -->
    <p class="notice" role="status" :class="{ 'visually-hidden': !message }">{{ message }}</p>

    <form
      class="panel"
      :aria-label="t('builder.settingsLabel')"
      @submit.prevent
      @input="dismissLinkWarning"
    >
      <ControlGroup
        :title="t('language.group')"
        :meta="t('language.available', { count: SHEET_LOCALES.length })"
      >
        <FieldRow
          :label="t('language.label')"
          :help="t('language.help')"
          :control-id="languageId"
          stacked
        >
          <select :id="languageId" v-model="locale" class="select">
            <option v-for="option in SHEET_LOCALES" :key="option.code" :value="option.code">
              {{ option.endonym }}
            </option>
          </select>
        </FieldRow>
        <p class="mono summary">{{ languageSummary }}</p>
      </ControlGroup>

      <ControlGroup
        :title="t('people.group')"
        :meta="t('people.count', { count: config.people.length, max: LIMITS.people.max })"
      >
        <ul class="people">
          <PersonRow
            v-for="(person, index) in config.people"
            :key="index"
            :person="person"
            :position="index + 1"
            :taken="takenSymbols"
            :can-remove="canRemovePerson"
            :open="openPerson === index"
            @update="(change) => sheet.updatePerson(index, change)"
            @remove="removePerson(index)"
            @toggle="togglePerson(index)"
          />
        </ul>

        <button v-if="canAddPerson" type="button" class="add" @click="addPerson">
          <span aria-hidden="true">+</span> {{ t('people.add') }}
        </button>

        <FieldRow :label="t('people.familyMark')" :help="t('people.familyMarkHelp')">
          <ToggleSwitch v-model="familyMark" :label="t('people.familyMark')" />
        </FieldRow>

        <FieldRow :label="t('people.markStyle')" stacked>
          <SegmentedControl
            v-model="markStyle"
            :label="t('people.markStyle')"
            :options="[
              { value: 'symbol', label: t('people.markStyle.symbol') },
              { value: 'initial', label: t('people.markStyle.initial') },
            ]"
          />
        </FieldRow>
      </ControlGroup>

      <ControlGroup :title="t('days.group')">
        <FieldRow
          :label="t('days.linesPerDay')"
          :value="t('days.linesEach', { height: layout.metrics.lineHeight })"
          stacked
        >
          <SegmentedControl
            v-model="linesPerDay"
            :label="t('days.linesPerDay')"
            :options="[
              { value: 1, label: '1' },
              { value: 2, label: '2' },
              { value: 3, label: '3' },
              { value: 4, label: '4' },
            ]"
          />
        </FieldRow>

        <FieldRow :label="t('days.weekendNames')" stacked>
          <SegmentedControl
            v-model="weekendStyle"
            :label="t('days.weekendNames')"
            :options="[
              { value: 'outline', label: t('days.weekend.outline') },
              { value: 'plain', label: t('days.weekend.plain') },
            ]"
          />
        </FieldRow>
      </ControlGroup>

      <ControlGroup :title="t('header.group')">
        <FieldRow
          :label="t('header.weekStarting')"
          :help="snapNotice ?? t('header.undated')"
          :control-id="weekStartingId"
          stacked
        >
          <input :id="weekStartingId" v-model="weekStarting" type="date" class="date" />
        </FieldRow>

        <FieldRow :label="t('header.weekNumber')">
          <ToggleSwitch v-model="showWeekNumber" :label="t('header.weekNumber')" />
        </FieldRow>
        <FieldRow :label="t('header.dateRange')">
          <ToggleSwitch v-model="showDateRange" :label="t('header.dateRange')" />
        </FieldRow>
        <FieldRow :label="t('header.dayDates')">
          <ToggleSwitch v-model="showDayDates" :label="t('header.dayDates')" />
        </FieldRow>
        <FieldRow :label="t('header.legend')">
          <ToggleSwitch v-model="showLegend" :label="t('header.legend')" />
        </FieldRow>
      </ControlGroup>

      <ControlGroup :title="t('paper.group')">
        <FieldRow :label="t('paper.size')" stacked>
          <SegmentedControl
            v-model="paper"
            :label="t('paper.size')"
            :options="[
              { value: 'A4', label: t('paper.a4') },
              { value: 'Letter', label: t('paper.letter') },
            ]"
          />
        </FieldRow>

        <FieldRow
          :label="t('paper.margin')"
          :value="`${config.marginMm} ${t('paper.marginUnit')}`"
          :control-id="marginId"
          stacked
        >
          <RangeSlider
            :id="marginId"
            v-model="marginMm"
            :min="LIMITS.marginMm.min"
            :max="LIMITS.marginMm.max"
            :label="t('paper.margin')"
          />
        </FieldRow>

        <FieldRow :label="t('paper.copies')" :help="t('paper.copiesHelp')" :control-id="copiesId">
          <StepperInput
            :id="copiesId"
            v-model="copies"
            :min="LIMITS.copies.min"
            :max="LIMITS.copies.max"
            :label="t('paper.copies')"
            :decrease-label="t('paper.decrease')"
            :increase-label="t('paper.increase')"
          />
        </FieldRow>
      </ControlGroup>

      <div class="panel-foot">
        <button type="button" class="ghost" @click="onCopyLink">{{ t('action.copyLink') }}</button>
        <button type="button" class="ghost" @click="onDownloadHtml">
          {{ t('action.downloadHtml') }}
        </button>
        <p class="mono foot-note">{{ t('builder.urlNote') }}<br />{{ t('builder.privacyNote') }}</p>
      </div>
    </form>

    <div class="stage" :aria-label="t('builder.previewLabel')" role="region">
      <FitStatus :layout="layout" :fit="fit" />
      <SheetPreview :svg="previewSvg" />
      <aside class="stage-note">
        <span class="eyebrow">{{ t('builder.noteLabel') }}</span>
        <p>{{ t('builder.urlNote') }} {{ t('builder.privacyNote') }}</p>
      </aside>
    </div>
  </div>
</template>

<style scoped>
.builder {
  display: grid;
  grid-template-columns: 340px minmax(0, 1fr);
  height: 100%;
  min-height: 0;
}

.panel {
  /* A grid item defaults to the size of its content in both axes, which lets a
     stepper widen the column and a long panel push past the viewport. */
  min-width: 0;
  min-height: 0;
  overflow-y: auto;
  border-right: 1px solid var(--border);
  background: var(--paper);
}

/* The sheet, its verdict and its footnote read as one column. */
.stage {
  display: flex;
  flex-direction: column;
  min-width: 0;
  min-height: 0;
  overflow: hidden;
  background: var(--desk);
}

.stage :deep(.stage-scroll) {
  flex: 1;
  min-height: 0;
}

.stage :deep(.status) {
  flex: none;
}

.stage-note {
  flex: none;
  display: flex;
  align-items: baseline;
  gap: 10px;
  margin: 0 var(--space-5) 18px;
  padding: 10px 14px;
  background: var(--paper-tint);
  border-radius: var(--radius-md);
}

.stage-note .eyebrow {
  flex: none;
  color: var(--accent);
}

.stage-note p {
  font-size: 13px;
  line-height: 1.5;
  color: var(--ink-soft);
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
  display: inline-flex;
  align-items: center;
  gap: var(--space-2);
  height: 36px;
  padding: 0 14px;
  border: none;
  border-radius: var(--radius-md);
  background: var(--paper-tint);
  font-size: 15px;
  font-weight: 700;
  color: var(--accent);
  cursor: pointer;
}

.add:hover {
  background: var(--accent-pale);
}

.select,
.date {
  width: 100%;
  height: 40px;
  padding: 0 14px;
  border: 1px solid var(--rule);
  border-radius: var(--radius-md);
  background: var(--white);
  font: inherit;
  font-size: 15px;
  color: var(--ink);
}

.select:focus,
.date:focus {
  border-color: var(--accent-mid);
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

  .stage {
    min-height: 70vh;
  }
}
</style>

<style>
/* Teleported into the site header, so these cannot be scoped to this component. */
#builder-actions {
  display: flex;
  align-items: center;
  gap: 10px;
  margin-left: auto;
}

#builder-actions .header-button {
  display: inline-flex;
  align-items: center;
  height: 40px;
  border-radius: var(--radius-md);
  font-size: 15px;
  font-weight: 700;
  cursor: pointer;
}

#builder-actions .header-button:disabled {
  opacity: 0.55;
  cursor: default;
}

/* See SiteHeader: the mid orange fails contrast for button text. */
#builder-actions .primary {
  padding: 0 22px;
  border: none;
  background: var(--accent);
  color: var(--paper);
}

#builder-actions .primary:hover:not(:disabled) {
  background: var(--ink);
}

#builder-actions .secondary {
  padding: 0 18px;
  border: 1px solid var(--rule);
  background: var(--paper);
  color: var(--ink);
}

#builder-actions .secondary:hover:not(:disabled) {
  border-color: var(--accent-mid);
  color: var(--accent);
}
</style>
