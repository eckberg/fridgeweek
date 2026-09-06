<script setup lang="ts">
/** A titled block of related controls in the settings panel. */
defineProps<{
  title: string;
  /** Small fact shown at the end of the title row, e.g. "4 of 6". */
  meta?: string;
}>();
</script>

<template>
  <section class="group">
    <div class="head">
      <h2 class="eyebrow">{{ title }}</h2>
      <span v-if="meta" class="mono">{{ meta }}</span>
    </div>
    <div class="body">
      <slot />
    </div>
  </section>
</template>

<style scoped>
.group {
  padding: var(--space-5) var(--space-5) var(--space-5);
  border-bottom: 1px solid var(--border);
}

.head {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  gap: var(--space-3);
  margin-bottom: var(--space-4);
}

h2 {
  font-size: 12px;
  font-weight: 500;
  letter-spacing: 0.12em;
}

.body {
  display: flex;
  flex-direction: column;
  gap: var(--space-4);
}
</style>
