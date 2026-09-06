/**
 * Icons drawn for Fridgeweek in the Lucide style: 24x24 grid, 2 unit stroke,
 * round caps and joins, no fills, at least 1 unit of padding. They exist
 * because children ask for them and Lucide has no unicorn.
 */
export const CUSTOM_IDS = ['dinosaur', 'firefighter-helmet', 'tiara', 'unicorn'] as const;

export type CustomId = (typeof CUSTOM_IDS)[number];

export const CUSTOM_SYMBOLS: Record<CustomId, string> = {
  dinosaur:
    '<path d="M3.6 6.4C3.6 4.4 4.6 3.2 6.2 3.8 7.2 4.2 7.6 5 7.4 6.2c.4 2.9 1.6 5 4 6.4l1.4-2.2 1.4 2.4 1.4-2.4 1.4 2.6c1.8 1 3.2 2.6 4.6 4.6-1.2.4-2.6-.2-4-1.2-2 1.6-5.6 1.8-8 .4-1.6-1-2.8-3.2-3-5.6-.3-1.8-1.4-3-3.2-3Z" />' +
    '<path d="M10.6 16.8v3.6" />' +
    '<path d="M15.4 16.4v4" />' +
    '<path d="M5.4 6.6h.01" />',
  'firefighter-helmet':
    '<path d="M2.8 14.2c.8-1 1.6-1.6 2.6-1.8C5.4 7.6 8.2 4.8 12 4.8c3.6 0 6.2 2.6 6.8 6.6.4 2.2 1.2 4 2.4 5.6-2.2 1.2-5.4 1.8-9.2 1.8-4.2 0-7.6-1.2-8.8-2.6-.4-.6-.6-1.4-.4-2Z" />' +
    '<path d="M9.6 12.8V9.6c0-.6.4-1 1-1h2.8c.6 0 1 .4 1 1v3.2c0 1.6-2.4 2.4-2.4 2.4s-2.4-.8-2.4-2.4Z" />',
  tiara:
    '<path d="M2.8 15.6c.4-3.4 2-5.2 3.4-4.4l2.8 3.2 3-7.6 3 7.6 2.8-3.2c1.4-.8 3 1 3.4 4.4-2.8 3.2-5.8 4.4-9.2 4.4s-6.4-1.2-9.2-4.4Z" />' +
    '<path d="m12 11 2.4 3-2.4 3-2.4-3Z" />',
  unicorn:
    '<path d="M4.6 14.4C6.2 11.8 8.4 9.6 10.8 8.2c1-.4 2-.6 3-.4 1.6.4 2.8 1.6 3.4 3.4.8 2.6 1.2 5.8 1.2 9 0 .6-.4 1-1 1H12c-.4-2.4-1.2-4.2-2.4-5.2l-3.2-.6c-1.4-.2-2.2-.6-1.8-1Z" />' +
    '<path d="M10.9 8.1 10.2 1.6l2.6 6.1" />' +
    '<path d="M14.6 8.1c1.4-2.6 2.6-3.4 3.6-2.4.6 1.6.4 3.2-.6 4.8" />' +
    '<path d="M10 11.6h.01" />' +
    '<path d="M6.6 13.8h.01" />',
};
