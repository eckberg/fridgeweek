<script setup lang="ts">
const model = defineModel<number>({ required: true });

defineProps<{
  min: number;
  max: number;
  step?: number;
  label: string;
  id: string;
}>();
</script>

<template>
  <div class="slider">
    <span class="mono bound" aria-hidden="true">{{ min }}</span>
    <input
      :id="id"
      type="range"
      :min="min"
      :max="max"
      :step="step ?? 1"
      :value="model"
      :aria-label="label"
      @input="model = Number(($event.target as HTMLInputElement).value)"
    />
    <span class="mono bound" aria-hidden="true">{{ max }}</span>
  </div>
</template>

<style scoped>
.slider {
  display: flex;
  align-items: center;
  gap: var(--space-3);
}

.bound {
  flex: none;
}

input {
  flex: 1;
  min-width: 0;
  height: 22px;
  margin: 0;
  appearance: none;
  background: transparent;
  cursor: pointer;
}

input::-webkit-slider-runnable-track {
  height: 3px;
  border-radius: var(--radius-pill);
  background: var(--accent-pale);
}

input::-moz-range-track {
  height: 3px;
  border-radius: var(--radius-pill);
  background: var(--accent-pale);
}

input::-webkit-slider-thumb {
  appearance: none;
  width: 18px;
  height: 18px;
  margin-top: -7.5px;
  border: 2px solid var(--accent-mid);
  border-radius: 50%;
  background: var(--white);
  box-shadow: var(--shadow-control);
}

input::-moz-range-thumb {
  width: 18px;
  height: 18px;
  border: 2px solid var(--accent-mid);
  border-radius: 50%;
  background: var(--white);
  box-shadow: var(--shadow-control);
}
</style>
