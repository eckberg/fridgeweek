<script setup lang="ts">
import { getSymbol, type SymbolId } from '@fridgeweek/core';
import { computed } from 'vue';

/** Draws one symbol from the core icon set at an arbitrary size. */
const props = defineProps<{
  id: SymbolId;
  size?: number;
  /** Given when the symbol carries meaning on its own rather than labelling text next to it. */
  title?: string;
}>();

const body = computed(() => getSymbol(props.id).body);
</script>

<template>
  <svg
    :width="size ?? 22"
    :height="size ?? 22"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    stroke-width="2"
    stroke-linecap="round"
    stroke-linejoin="round"
    :role="title ? 'img' : undefined"
    :aria-label="title"
    :aria-hidden="title ? undefined : 'true'"
    v-html="body"
  />
</template>

<style scoped>
svg {
  display: block;
  flex: none;
}
</style>
