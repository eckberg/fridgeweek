<script setup lang="ts">
/**
 * A label on the left, a control on the right, with optional helper text and a
 * monospaced value (a measurement, a count) above the control.
 */
const props = defineProps<{
  label: string;
  help?: string;
  value?: string;
  /** Id of the control the label belongs to. Omit for grouped controls that label themselves. */
  controlId?: string;
  /** Stack the control under the label instead of beside it. */
  stacked?: boolean;
  /**
   * Give the label and its help the full width, and put the value beside the
   * control on the row below. A label with helper text and a value next to it
   * shares a narrow column three ways and wraps the help mid-phrase.
   */
  split?: boolean;
}>();
</script>

<template>
  <div class="row" :class="{ stacked, split, 'has-value': value !== undefined }">
    <div class="text">
      <label v-if="props.controlId" :for="props.controlId" class="label">{{ label }}</label>
      <span v-else class="label">{{ label }}</span>
      <span v-if="help" class="help">{{ help }}</span>
    </div>
    <span v-if="value !== undefined" class="mono value">{{ value }}</span>
    <div class="control">
      <slot />
    </div>
  </div>
</template>

<style scoped>
.row {
  display: grid;
  grid-template-columns: 1fr auto;
  grid-template-areas: 'text control';
  align-items: center;
  gap: var(--space-3);
}

.row.has-value,
.row.stacked {
  grid-template-areas: 'text value' 'control control';
  row-gap: var(--space-2);
}

.row.stacked:not(.has-value) {
  grid-template-columns: 1fr;
  grid-template-areas: 'text' 'control';
}

/* Text across the top, then the control on the left with its value opposite. */
.row.split {
  grid-template-columns: auto minmax(0, 1fr);
  grid-template-areas: 'text text' 'control value';
  row-gap: var(--space-3);
}

.text {
  grid-area: text;
  display: flex;
  flex-direction: column;
  gap: 2px;
  min-width: 0;
}

.label {
  font-size: 15px;
  font-weight: 700;
}

.help {
  font-size: 13px;
  color: var(--ink-faint);
  line-height: 1.4;
}

.value {
  grid-area: value;
  white-space: nowrap;
  align-self: center;
}

/* Beside a control rather than above it, so it right-aligns and may wrap. */
.row.split .value {
  justify-self: end;
  text-align: right;
  white-space: normal;
  line-height: 1.4;
}

.control {
  grid-area: control;
  min-width: 0;
}
</style>
