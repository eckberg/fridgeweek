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

function commit(event: Event): void {
  const raw = Number((event.target as HTMLInputElement).value);
  if (!Number.isFinite(raw)) return;
  model.value = Math.min(props.max, Math.max(props.min, Math.round(raw)));
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
.stepper {
  display: flex;
  align-items: center;
  gap: var(--space-1);
  padding: 3px;
  border: 1px solid var(--border);
  border-radius: var(--radius-md);
  background: var(--white);
}

button {
  width: 30px;
  height: 30px;
  border: none;
  border-radius: var(--radius-sm);
  background: var(--paper-sunk);
  font-size: 17px;
  line-height: 1;
  cursor: pointer;
}

button:hover:not(:disabled) {
  background: var(--paper-tint);
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
