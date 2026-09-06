<script setup lang="ts" generic="T extends string | number">
interface Option {
  value: T;
  label: string;
}

const model = defineModel<T>({ required: true });
defineProps<{ options: Option[]; label: string }>();
</script>

<template>
  <div class="segmented" role="radiogroup" :aria-label="label">
    <button
      v-for="option in options"
      :key="String(option.value)"
      type="button"
      role="radio"
      :aria-checked="model === option.value"
      class="segment"
      @click="model = option.value"
    >
      {{ option.label }}
    </button>
  </div>
</template>

<style scoped>
.segmented {
  display: flex;
  padding: 3px;
  gap: 3px;
  border-radius: var(--radius-md);
  background: var(--paper-tint);
}

.segment {
  flex: 1;
  padding: var(--space-2) var(--space-3);
  border: 1px solid transparent;
  border-radius: var(--radius-sm);
  background: transparent;
  font-size: 15px;
  font-weight: 700;
  color: var(--ink-soft);
  cursor: pointer;
  white-space: nowrap;
  transition: background var(--transition), color var(--transition);
}

.segment:hover {
  color: var(--ink);
}

.segment[aria-checked='true'] {
  background: var(--white);
  border-color: var(--border);
  color: var(--ink);
  box-shadow: var(--shadow-control);
}
</style>
