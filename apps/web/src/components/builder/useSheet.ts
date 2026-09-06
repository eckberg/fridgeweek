import {
  computeLayout,
  type LayoutIssue,
  type Person,
  renderSheet,
  renderSvg,
  type SheetConfig,
} from '@fridgeweek/core';
import { computed, ref, watch } from 'vue';
import { applyChange, loadConfig, readHash, saveConfig, shareUrl } from '../../lib/sheetState.js';

/**
 * The builder's single source of truth. One configuration object, validated on
 * every change, with the layout and the rendered sheet derived from it.
 *
 * Nothing here touches the network. The rendering is synchronous and fast
 * enough (a few milliseconds) to run on every keystroke.
 */
export function useSheet() {
  const initial = loadConfig(
    typeof location === 'undefined' ? '' : location.hash,
    typeof localStorage === 'undefined' ? null : localStorage,
  );

  const config = ref<SheetConfig>(initial.config);
  const linkWasBroken = ref(initial.issues !== undefined);
  /** The encoding last written to the address bar, so an echo can be recognised. */
  let writtenHash = '';

  const layout = computed(() => computeLayout(config.value));
  const previewSvg = computed(() => renderSvg(config.value, { idPrefix: 'preview' }));

  const issues = computed<LayoutIssue[]>(() => layout.value.issues);
  const errors = computed(() => issues.value.filter((i) => i.severity === 'error'));
  const warnings = computed(() => issues.value.filter((i) => i.severity === 'warning'));

  const fit = computed<'comfortable' | 'tight' | 'impossible'>(() => {
    if (errors.value.length > 0) return 'impossible';
    if (warnings.value.length > 0) return 'tight';
    return 'comfortable';
  });

  function update(change: Partial<SheetConfig>): void {
    const result = applyChange(config.value, change);
    config.value = result.config;
  }

  function updatePerson(index: number, change: Partial<Person>): void {
    const people = config.value.people.map((person, i) =>
      i === index ? { ...person, ...change } : person,
    );
    update({ people });
  }

  function addPerson(person: Person): void {
    update({ people: [...config.value.people, person] });
  }

  function removePerson(index: number): void {
    if (config.value.people.length <= 1) return;
    update({ people: config.value.people.filter((_, i) => i !== index) });
  }

  function clearWeekStarting(): void {
    const { weekStarting: _drop, ...rest } = config.value;
    const result = applyChange(rest as SheetConfig, {});
    config.value = result.config;
  }

  /** The complete printable document, built only when it is actually needed. */
  function printableHtml(copies = config.value.copies): string {
    return renderSheet({ ...config.value, copies }, { title: 'Fridgeweek' });
  }

  function link(): string {
    if (typeof location === 'undefined') return '';
    return shareUrl(location.origin, location.pathname, config.value);
  }

  // Persist on every change. `replaceState` keeps the back button useful:
  // dragging a slider should not fill the history with fifty entries.
  watch(
    config,
    (next) => {
      const encoded = saveConfig(next, typeof localStorage === 'undefined' ? null : localStorage);
      if (typeof history !== 'undefined' && typeof location !== 'undefined') {
        writtenHash = encoded;
        history.replaceState(null, '', `${location.pathname}#${encoded}`);
      }
    },
    { deep: true },
  );

  /**
   * Someone pasted a different sheet into the address bar, or used the back
   * button. A hash this component wrote itself is ignored, so adopting it
   * cannot loop back into the watcher that wrote it.
   */
  function adoptHash(): void {
    if (typeof location === 'undefined') return;
    const encoded = readHash(location.hash);
    if (encoded === null || encoded === writtenHash) return;

    const result = loadConfig(location.hash, null);
    if (result.source === 'url') {
      writtenHash = encoded;
      config.value = result.config;
    }
  }

  return {
    config,
    layout,
    previewSvg,
    issues,
    errors,
    warnings,
    fit,
    linkWasBroken,
    update,
    updatePerson,
    addPerson,
    removePerson,
    clearWeekStarting,
    printableHtml,
    link,
    adoptHash,
  };
}

export type SheetController = ReturnType<typeof useSheet>;
