/**
 * Regulation M-B roster for Pokémon Champions ranked battles.
 *
 * Sources (retrieved 2026-08-10):
 * - Pokémon Showdown champions mod (authoritative, machine-readable):
 *   https://github.com/smogon/pokemon-showdown/blob/master/data/mods/champions/formats-data.ts
 *   (species with a tier other than "Illegal" and no isNonstandard flag;
 *   format "[Gen 9 Champions] VGC 2026 Reg M-B" in config/formats.ts uses this mod)
 * - Cross-checked against Serebii's Regulation M-B page (dates, the 23 species
 *   and 16 mega formes newly added over Reg M-A all match):
 *   https://www.serebii.net/pokemonchampions/rankedbattle/regulationm-b.shtml
 * - Spot-checked against Game8's Regulation M-B roster page (dates + 20
 *   edge-case species confirmed): https://game8.co/games/Pokemon-Champions/archives/605482
 *
 * Notes:
 * - "Floette-Eternal" stands in for Mega Floette's base (plain Floette is
 *   illegal in the mod; the mega resolves via Floette-Mega).
 * - Meowstic and Meowstic-F are listed separately; each has its own mega
 *   (Meowstic-M-Mega / Meowstic-F-Mega).
 * - Regenerate downstream JSON with `npm run data:all`.
 */

export const REGULATION_M_B = {
  id: 'm-b',
  label: 'Regulation M-B',
  dateRange: ['2026-06-17', '2026-09-02'] as [string, string],
  clauses: ['species', 'item'],
  bannedItems: [] as string[],

  // Species names as Showdown recognizes them (235 species).
  allowedSpecies: [
    'Venusaur', 'Charizard', 'Blastoise', 'Beedrill', 'Pidgeot', 'Arbok', 'Pikachu', 'Raichu',
    'Raichu-Alola', 'Clefable', 'Ninetales', 'Ninetales-Alola', 'Vileplume', 'Arcanine',
    'Arcanine-Hisui', 'Politoed', 'Alakazam', 'Machamp', 'Victreebel', 'Slowbro',
    'Slowbro-Galar', 'Slowking', 'Slowking-Galar', 'Gengar', 'Steelix', 'Rhyperior',
    'Kangaskhan', 'Starmie', 'Mr. Rime', 'Scizor', 'Kleavor', 'Pinsir', 'Tauros',
    'Tauros-Paldea-Combat', 'Tauros-Paldea-Blaze', 'Tauros-Paldea-Aqua', 'Gyarados', 'Ditto',
    'Vaporeon', 'Jolteon', 'Flareon', 'Espeon', 'Umbreon', 'Leafeon', 'Glaceon', 'Sylveon',
    'Aerodactyl', 'Snorlax', 'Dragonite', 'Meganium', 'Typhlosion', 'Typhlosion-Hisui',
    'Feraligatr', 'Ariados', 'Ampharos', 'Azumarill', 'Farigiraf', 'Forretress', 'Gliscor',
    'Qwilfish', 'Overqwil', 'Heracross', 'Weavile', 'Sneasler', 'Mamoswine', 'Skarmory',
    'Houndoom', 'Wyrdeer', 'Tyranitar', 'Sceptile', 'Blaziken', 'Swampert', 'Pelipper',
    'Gardevoir', 'Gallade', 'Sableye', 'Mawile', 'Aggron', 'Medicham', 'Manectric', 'Roserade',
    'Sharpedo', 'Camerupt', 'Torkoal', 'Altaria', 'Milotic', 'Castform', 'Banette', 'Chimecho',
    'Absol', 'Glalie', 'Froslass', 'Metagross', 'Torterra', 'Infernape', 'Empoleon',
    'Staraptor', 'Luxray', 'Rampardos', 'Bastiodon', 'Lopunny', 'Spiritomb', 'Garchomp',
    'Lucario', 'Hippowdon', 'Toxicroak', 'Abomasnow', 'Rotom', 'Rotom-Heat', 'Rotom-Wash',
    'Rotom-Frost', 'Rotom-Fan', 'Rotom-Mow', 'Serperior', 'Emboar', 'Samurott',
    'Samurott-Hisui', 'Watchog', 'Liepard', 'Simisage', 'Simisear', 'Simipour', 'Musharna',
    'Excadrill', 'Audino', 'Conkeldurr', 'Scolipede', 'Whimsicott', 'Basculegion',
    'Basculegion-F', 'Krookodile', 'Scrafty', 'Cofagrigus', 'Runerigus', 'Garbodor', 'Zoroark',
    'Zoroark-Hisui', 'Reuniclus', 'Vanilluxe', 'Emolga', 'Eelektross', 'Chandelure', 'Beartic',
    'Stunfisk', 'Stunfisk-Galar', 'Golurk', 'Hydreigon', 'Volcarona', 'Chesnaught', 'Delphox',
    'Greninja', 'Diggersby', 'Talonflame', 'Vivillon', 'Pyroar', 'Floette-Eternal', 'Florges',
    'Pangoro', 'Furfrou', 'Meowstic', 'Meowstic-F', 'Aegislash', 'Aromatisse', 'Slurpuff',
    'Malamar', 'Barbaracle', 'Dragalge', 'Clawitzer', 'Heliolisk', 'Tyrantrum', 'Aurorus',
    'Hawlucha', 'Dedenne', 'Goodra', 'Goodra-Hisui', 'Klefki', 'Trevenant', 'Gourgeist',
    'Gourgeist-Small', 'Gourgeist-Large', 'Gourgeist-Super', 'Avalugg', 'Avalugg-Hisui',
    'Noivern', 'Decidueye', 'Decidueye-Hisui', 'Incineroar', 'Primarina', 'Toucannon',
    'Crabominable', 'Lycanroc', 'Lycanroc-Midnight', 'Lycanroc-Dusk', 'Toxapex', 'Mudsdale',
    'Araquanid', 'Salazzle', 'Tsareena', 'Oranguru', 'Passimian', 'Mimikyu', 'Drampa',
    'Kommo-o', 'Corviknight', 'Flapple', 'Appletun', 'Sandaconda', 'Polteageist', 'Hatterene',
    'Grimmsnarl', 'Alcremie', 'Falinks', 'Morpeko', 'Dragapult', 'Meowscarada', 'Skeledirge',
    'Quaquaval', 'Houndstone', 'Espathra', 'Palafin', 'Scovillain', 'Bellibolt', 'Orthworm',
    'Maushold', 'Garganacl', 'Glimmora', 'Gholdengo', 'Tinkaton', 'Armarouge', 'Ceruledge',
    'Kingambit', 'Annihilape', 'Sinistcha', 'Archaludon', 'Hydrapple',
  ],

  // Species allowed to mega evolve via the Omni Ring (74 bases; Charizard and
  // Raichu each resolve to X + Y formes). The build script resolves each to its
  // "-Mega" forme(s) and warns if Showdown data doesn't know the forme yet.
  allowedMegas: [
    'Venusaur', 'Charizard', 'Blastoise', 'Beedrill', 'Pidgeot', 'Raichu', 'Clefable',
    'Alakazam', 'Victreebel', 'Slowbro', 'Gengar', 'Steelix', 'Kangaskhan', 'Starmie',
    'Scizor', 'Pinsir', 'Gyarados', 'Aerodactyl', 'Dragonite', 'Meganium', 'Feraligatr',
    'Ampharos', 'Heracross', 'Skarmory', 'Houndoom', 'Tyranitar', 'Sceptile', 'Blaziken',
    'Swampert', 'Gardevoir', 'Gallade', 'Sableye', 'Mawile', 'Aggron', 'Medicham', 'Manectric',
    'Sharpedo', 'Camerupt', 'Altaria', 'Banette', 'Chimecho', 'Absol', 'Glalie', 'Froslass',
    'Metagross', 'Staraptor', 'Lopunny', 'Garchomp', 'Lucario', 'Abomasnow', 'Emboar',
    'Excadrill', 'Audino', 'Scolipede', 'Scrafty', 'Eelektross', 'Chandelure', 'Golurk',
    'Chesnaught', 'Delphox', 'Greninja', 'Pyroar', 'Floette-Eternal', 'Meowstic', 'Meowstic-F',
    'Malamar', 'Barbaracle', 'Dragalge', 'Hawlucha', 'Crabominable', 'Drampa', 'Falinks',
    'Scovillain', 'Glimmora',
  ],
};
