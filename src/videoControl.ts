/** Module-level ref so GamePage can trigger play() directly inside a user gesture. */
export let triggerVideoPlay: (() => void) | null = null
export function registerVideoPlay(fn: () => void) { triggerVideoPlay = fn }
