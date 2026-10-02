/**
 * Dex-authoritative ability lists per species/forme, registered once when the
 * dex bundle loads. The damage-calc library's own forme data lags Showdown
 * (e.g. Golisopod-Mega listed with Emergency Exit, not Tough Claws) and omits
 * hidden abilities, so the engine consults this before trusting the library.
 * Kept engine-pure (no calc import) so the data layer can fill it without
 * dragging @smogon/calc into the main chunk.
 */
const toId = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, '');

const registry = new Map<string, string[]>();

export function registerSpeciesAbilities(
  entries: Iterable<{ name: string; abilities: string[] }>,
): void {
  for (const e of entries) registry.set(toId(e.name), [...e.abilities]);
}

/** Registered abilities for a species/forme name, or undefined if unknown. */
export function knownAbilities(nameOrId: string): string[] | undefined {
  return registry.get(toId(nameOrId));
}
