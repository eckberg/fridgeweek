import en from './locales/en.json';

/**
 * The words of the interface.
 *
 * The interface is English. The *sheet* is translated, because the sheet is the
 * product: its weekday names and dates come from `Intl` and its two printed
 * words from `@fridgeweek/core`, so a Swedish family prints a Swedish sheet
 * from an English page.
 *
 * Keeping the strings here rather than inline still earns its place: it puts
 * the whole vocabulary of the product in one file, where wording can be made
 * consistent and reviewed on its own.
 */

export type MessageKey = keyof typeof en;

const MESSAGES: Readonly<Record<MessageKey, string>> = en;

/** Looks up a string, filling any `{placeholder}` from `params`. */
export function t(key: MessageKey, params?: Record<string, string | number>): string {
  const template = MESSAGES[key];
  if (!params) return template;
  return template.replace(/\{(\w+)\}/g, (match, name: string) => {
    const value = params[name];
    return value === undefined ? match : String(value);
  });
}
