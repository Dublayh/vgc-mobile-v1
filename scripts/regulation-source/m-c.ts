/**
 * Regulation M-C roster for Pokémon Champions ranked battles.
 *
 * Sources (retrieved 2026-09-11):
 * - Pokémon Showdown champions mod (authoritative, machine-readable):
 *   https://github.com/smogon/pokemon-showdown/blob/master/data/mods/champions/formats-data.ts
 *   (species with a tier other than "Illegal" and no isNonstandard flag; the
 *   `champions` mod IS the current regulation — M-B was frozen into a separate
 *   `championsregmb` mod when M-C went live. Format "[Gen 9 Champions]
 *   VGC 2026 Reg M-C" in config/formats.ts uses this mod.)
 * - Cross-checked against Serebii's Regulation M-C page (Season M-6 dates and
 *   all 25 newly-usable species + 3 new mega lines + 3 Mega-Z formes match):
 *   https://www.serebii.net/pokemonchampions/rankedbattle/regulationm-c.shtml
 *
 * Changes over Reg M-B (strict superset — nothing was cut):
 * - +25 species (Salamence, Rillaboom, Cinderace, Inteleon, Baxcalibur,
 *   Golisopod, Toxtricity, Indeedee/-F, Pawmot, Mabosstiff, ...).
 * - +3 mega lines: Salamence, Golisopod, Baxcalibur.
 * - NEW Mega-Z formes: Absol-Mega-Z, Garchomp-Mega-Z, Lucario-Mega-Z —
 *   additional megas of already-mega-capable species, holding their own stones
 *   (Absolite Z / Garchompite Z / Lucarionite Z). build-regulation resolves
 *   them via the '-Mega-Z' suffix.
 *
 * Notes:
 * - "Floette-Eternal" stands in for Mega Floette's base (plain Floette is
 *   illegal in the mod; the mega resolves via Floette-Mega).
 * - Meowstic-F has no entry of its own in the mod's formats-data (it inherits
 *   legality from the base `meowstic` entry, exactly as in the frozen M-B
 *   mod) — it is listed explicitly here, with its own mega, as in M-B.
 * - Toxtricity-Low-Key and the Squawkabilly plumages are explicitly Illegal in
 *   the mod; only the base formes are listed.
 * - dateRange start is Season M-6's opening day per Serebii (2026-09-09); the
 *   end date extends as later seasons keep the regulation.
 * - Regenerate downstream JSON with `npm run data:all`.
 */

export const REGULATION_M_C = {
  id: 'm-c',
  label: 'Regulation M-C',
  dateRange: ['2026-09-09', '2026-10-07'] as [string, string],
  clauses: ['species', 'item'],
  bannedItems: [] as string[],

  // Species names as Showdown recognizes them (260 species).
  allowedSpecies: [
    'Venusaur', 'Charizard', 'Blastoise', 'Beedrill', 'Pidgeot', 'Arbok', 'Pikachu', 'Raichu',
    'Raichu-Alola', 'Clefable', 'Ninetales', 'Ninetales-Alola', 'Wigglytuff', 'Vileplume',
    'Persian', 'Persian-Alola', 'Perrserker', 'Arcanine', 'Arcanine-Hisui', 'Politoed',
    'Alakazam', 'Machamp', 'Victreebel', 'Slowbro', 'Slowbro-Galar', 'Slowking',
    'Slowking-Galar', 'Farfetch’d', 'Sirfetch’d', 'Gengar', 'Steelix', 'Rhyperior',
    'Kangaskhan', 'Starmie', 'Mr. Mime', 'Mr. Rime', 'Scizor', 'Kleavor', 'Pinsir', 'Tauros',
    'Tauros-Paldea-Combat', 'Tauros-Paldea-Blaze', 'Tauros-Paldea-Aqua', 'Gyarados', 'Ditto',
    'Vaporeon', 'Jolteon', 'Flareon', 'Espeon', 'Umbreon', 'Leafeon', 'Glaceon', 'Sylveon',
    'Aerodactyl', 'Snorlax', 'Dragonite', 'Meganium', 'Typhlosion', 'Typhlosion-Hisui',
    'Feraligatr', 'Ariados', 'Ampharos', 'Azumarill', 'Farigiraf', 'Forretress', 'Gliscor',
    'Qwilfish', 'Overqwil', 'Heracross', 'Weavile', 'Sneasler', 'Mamoswine', 'Skarmory',
    'Houndoom', 'Wyrdeer', 'Tyranitar', 'Sceptile', 'Blaziken', 'Swampert', 'Pelipper',
    'Gardevoir', 'Gallade', 'Sableye', 'Mawile', 'Aggron', 'Medicham', 'Manectric', 'Roserade',
    'Swalot', 'Sharpedo', 'Camerupt', 'Torkoal', 'Altaria', 'Milotic', 'Castform', 'Banette',
    'Chimecho', 'Absol', 'Glalie', 'Froslass', 'Salamence', 'Metagross', 'Torterra',
    'Infernape', 'Empoleon', 'Staraptor', 'Luxray', 'Rampardos', 'Bastiodon', 'Lopunny',
    'Spiritomb', 'Garchomp', 'Lucario', 'Hippowdon', 'Toxicroak', 'Abomasnow', 'Rotom',
    'Rotom-Heat', 'Rotom-Wash', 'Rotom-Frost', 'Rotom-Fan', 'Rotom-Mow', 'Serperior', 'Emboar',
    'Samurott', 'Samurott-Hisui', 'Watchog', 'Liepard', 'Simisage', 'Simisear', 'Simipour',
    'Musharna', 'Excadrill', 'Audino', 'Conkeldurr', 'Scolipede', 'Whimsicott', 'Basculegion',
    'Basculegion-F', 'Krookodile', 'Scrafty', 'Cofagrigus', 'Runerigus', 'Garbodor', 'Zoroark',
    'Zoroark-Hisui', 'Reuniclus', 'Vanilluxe', 'Emolga', 'Eelektross', 'Chandelure', 'Beartic',
    'Stunfisk', 'Stunfisk-Galar', 'Golurk', 'Hydreigon', 'Volcarona', 'Chesnaught', 'Delphox',
    'Greninja', 'Diggersby', 'Talonflame', 'Vivillon', 'Pyroar', 'Floette-Eternal', 'Florges',
    'Gogoat', 'Pangoro', 'Furfrou', 'Meowstic', 'Meowstic-F', 'Aegislash', 'Aromatisse',
    'Slurpuff', 'Malamar', 'Barbaracle', 'Dragalge', 'Clawitzer', 'Heliolisk', 'Tyrantrum',
    'Aurorus', 'Hawlucha', 'Dedenne', 'Goodra', 'Goodra-Hisui', 'Klefki', 'Trevenant',
    'Gourgeist', 'Gourgeist-Small', 'Gourgeist-Large', 'Gourgeist-Super', 'Avalugg',
    'Avalugg-Hisui', 'Noivern', 'Decidueye', 'Decidueye-Hisui', 'Incineroar', 'Primarina',
    'Toucannon', 'Crabominable', 'Lycanroc', 'Lycanroc-Midnight', 'Lycanroc-Dusk', 'Toxapex',
    'Mudsdale', 'Araquanid', 'Salazzle', 'Tsareena', 'Oranguru', 'Passimian', 'Golisopod',
    'Mimikyu', 'Drampa', 'Kommo-o', 'Rillaboom', 'Cinderace', 'Inteleon', 'Corviknight',
    'Thievul', 'Flapple', 'Appletun', 'Sandaconda', 'Toxtricity', 'Grapploct', 'Polteageist',
    'Hatterene', 'Grimmsnarl', 'Alcremie', 'Falinks', 'Pincurchin', 'Indeedee', 'Indeedee-F',
    'Morpeko', 'Dragapult', 'Meowscarada', 'Skeledirge', 'Quaquaval', 'Houndstone', 'Espathra',
    'Palafin', 'Arboliva', 'Scovillain', 'Bellibolt', 'Orthworm', 'Maushold', 'Baxcalibur',
    'Pawmot', 'Squawkabilly', 'Garganacl', 'Glimmora', 'Mabosstiff', 'Gholdengo', 'Tinkaton',
    'Armarouge', 'Ceruledge', 'Kingambit', 'Annihilape', 'Sinistcha', 'Archaludon', 'Hydrapple',
  ],

  // Species allowed to mega evolve via the Omni Ring (77 bases; Charizard and
  // Raichu resolve to X + Y formes; Absol, Garchomp and Lucario additionally
  // resolve to their new -Mega-Z formes). The build script resolves each base
  // to its "-Mega"/"-Mega-X/Y/Z" forme(s) and warns if Showdown data doesn't
  // know a forme yet.
  allowedMegas: [
    'Venusaur', 'Charizard', 'Blastoise', 'Beedrill', 'Pidgeot', 'Raichu', 'Clefable',
    'Alakazam', 'Victreebel', 'Slowbro', 'Gengar', 'Steelix', 'Kangaskhan', 'Starmie',
    'Scizor', 'Pinsir', 'Gyarados', 'Aerodactyl', 'Dragonite', 'Meganium', 'Feraligatr',
    'Ampharos', 'Heracross', 'Skarmory', 'Houndoom', 'Tyranitar', 'Sceptile', 'Blaziken',
    'Swampert', 'Gardevoir', 'Gallade', 'Sableye', 'Mawile', 'Aggron', 'Medicham', 'Manectric',
    'Sharpedo', 'Camerupt', 'Altaria', 'Banette', 'Chimecho', 'Absol', 'Glalie', 'Froslass',
    'Salamence', 'Metagross', 'Staraptor', 'Lopunny', 'Garchomp', 'Lucario', 'Abomasnow',
    'Emboar', 'Excadrill', 'Audino', 'Scolipede', 'Scrafty', 'Eelektross', 'Chandelure',
    'Golurk', 'Chesnaught', 'Delphox', 'Greninja', 'Pyroar', 'Floette-Eternal', 'Meowstic',
    'Meowstic-F', 'Malamar', 'Barbaracle', 'Dragalge', 'Hawlucha', 'Crabominable', 'Golisopod',
    'Drampa', 'Falinks', 'Scovillain', 'Baxcalibur', 'Glimmora',
  ],
};
