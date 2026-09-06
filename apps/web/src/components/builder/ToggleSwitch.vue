<script setup lang="ts">
import { useId } from 'vue';

const model = defineModel<boolean>({ required: true });
defineProps<{ label: string }>();

const id = useId();
</script>

<template>
  <button
    :id="id"
    type="button"
    role="switch"
    class="switch"
    :aria-checked="model"
    :aria-label="label"
    @click="model = !model"
  >
    <span class="knob" />
  </button>
</template>

<style scoped>
.switch {
  width: 46px;
  height: 26px;
  padding: 3px;
  border: none;
  border-radius: var(--radius-pill);
  background: var(--separator);
  cursor: pointer;
  transition: background var(--transition);
  display: flex;
  justify-content: flex-start;
}

.switch[aria-checked='true'] {
  background: var(--accent-mid);
  justify-content: flex-end;
}

.knob {
  display: block;
  width: 20px;
  height: 20px;
  border-radius: 50%;
  background: var(--white);
  box-shadow: var(--shadow-control);
  transition: transform var(--transition);
}
</style>
