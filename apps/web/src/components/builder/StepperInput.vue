<script setup lang="ts">
import { computed } from 'vue';

const model = defineModel<number>({ required: true });

const props = defineProps<{
  min: number;
  max: number;
  label: string;
  decreaseLabel: string;
  increaseLabel: string;
  id: string;
}>();

const canDecrease = computed(() => model.value > props.min);
const canIncrease = computed(() => model.value < props.max);

function nudge(delta: number): void {
  model.value = Math.min(props.max, Math.max(props.min, model.value + delta));
}

/**
 * Writing a clamped value back is not enough on its own: if it equals the
 * value already held, nothing re-renders and the field keeps showing what was
 * typed. The element is corrected directly as well.
 */
function commit(event: Event): void {
  const input = event.target as HTMLInputElement;
  const raw = Number(input.value);
  const next = Number.isFinite(raw)
    ? Math.min(props.max, Math.max(props.min, Math.round(raw)))
    : model.value;

  model.value = next;
  input.value = String(next);
}
</script>

<template>
  <div class="stepper">
    <button type="button" :aria-label="decreaseLabel" :disabled="!canDecrease" @click="nudge(-1)">
      <span aria-hidden="true">&minus;</span>
    </button>
    <input
      :id="id"
      type="number"
      inputmode="numeric"
      :min="min"
      :max="max"
      :value="model"
      :aria-label="label"
      @change="commit"
    />
    <button type="button" :aria-label="increaseLabel" :disabled="!canIncrease" @click="nudge(1)">
      <span aria-hidden="true">+</span>
    </button>
  </div>
</template>

<style scoped>
/*
 * Hugs its three controls. Stretched to whatever cell it lands in, the buttons
 * pack to one end and the rest of the track is empty sunk paper, which reads
 * as a mistake rather than as a control.
 */
.stepper {
  display: inline-flex;
  align-items: center;
  gap: 2px;
  padding: 3px;
  border-radius: var(--radius-md);
  background: var(--paper-sunk);
}

button {
  /* Centred by the box rather than by the glyph: a plus and a minus sign do
     not share a vertical centre, and side by side that shows. */
  display: grid;
  place-items: center;
  width: 30px;
  height: 30px;
  padding: 0;
  border: none;
  border-radius: var(--radius-sm);
  background: var(--white);
  font-size: 17px;
  line-height: 1;
  cursor: pointer;
}

button:hover:not(:disabled) {
  background: var(--paper-tint);
  color: var(--accent);
}

button:disabled {
  opacity: 0.4;
  cursor: default;
}

input {
  width: 44px;
  border: none;
  background: transparent;
  text-align: center;
  font: 500 16px/1 var(--font-mono);
  color: var(--ink);
  appearance: textfield;
}

input::-webkit-outer-spin-button,
input::-webkit-inner-spin-button {
  appearance: none;
  margin: 0;
}
</style>
