const TYPES = [
  'normal', 'fire', 'water', 'electric', 'grass', 'ice', 'fighting', 'poison',
  'ground', 'flying', 'psychic', 'bug', 'rock', 'ghost', 'dragon', 'dark',
  'steel', 'fairy',
] as const;

export type PokemonType = (typeof TYPES)[number];

export const POKEMON_TYPES: readonly PokemonType[] = TYPES;

/** Mid-dark type colors read better with light text; the rest take ink. */
const LIGHT_TEXT = new Set<PokemonType>([
  'water', 'fighting', 'poison', 'ghost', 'dragon', 'dark', 'steel', 'ground',
]);

export function TypeBadge({
  type,
  size = 'md',
}: {
  type: PokemonType | string;
  size?: 'sm' | 'md';
}) {
  const t = type.toLowerCase() as PokemonType;
  const light = LIGHT_TEXT.has(t);
  return (
    <span
      className={`chamfer-sm inline-flex items-center justify-center font-display font-semibold uppercase ${
        size === 'sm'
          ? 'min-w-14 px-1.5 py-px text-[0.7rem] tracking-[0.1em]'
          : 'min-w-18 px-2 py-0.5 text-[0.8rem] tracking-[0.12em]'
      } ${light ? 'text-white/95' : 'text-ink-950'}`}
      style={{ backgroundColor: `var(--color-type-${t})` }}
    >
      {t}
    </span>
  );
}
