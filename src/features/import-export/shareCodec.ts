/**
 * ShareCodec (plan §4): team → compressed URL fragment — no server involved.
 * JSON → deflate-raw → base64url, decoded back on the #share/<blob> route.
 */
import { EMPTY_SP, STAT_IDS, type ChampionsSet, type Team } from '../../engine/types';

/** Wire format v1 — compact keys, tolerant decode. */
interface WireTeam {
  v: 1;
  n: string; // name
  r: string; // regulation
  f: 'doubles' | 'singles';
  s: WireSet[];
}
interface WireSet {
  sp: string; // species
  mg?: string; // megaStone
  ab: string;
  it?: string;
  al: string;
  p: number[]; // sp spread in STAT_IDS order
  mv: string[];
}

async function pipeThrough(
  data: Uint8Array,
  stream: CompressionStream | DecompressionStream,
): Promise<Uint8Array> {
  const blob = new Blob([data as BlobPart]);
  const out = blob.stream().pipeThrough(stream as ReadableWritablePair<Uint8Array, Uint8Array>);
  return new Uint8Array(await new Response(out).arrayBuffer());
}

const toBase64Url = (bytes: Uint8Array): string =>
  btoa(String.fromCharCode(...bytes)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');

const fromBase64Url = (s: string): Uint8Array =>
  Uint8Array.from(atob(s.replace(/-/g, '+').replace(/_/g, '/')), (c) => c.charCodeAt(0));

export async function encodeTeamShare(team: Team): Promise<string> {
  const wire: WireTeam = {
    v: 1,
    n: team.name,
    r: team.regulation,
    f: team.format,
    s: team.sets.map((set) => ({
      sp: set.species,
      ...(set.megaStone ? { mg: set.megaStone } : {}),
      ab: set.ability,
      ...(set.item ? { it: set.item } : {}),
      al: set.alignment,
      p: STAT_IDS.map((id) => set.sp[id]),
      mv: set.moves.filter((m): m is string => !!m),
    })),
  };
  const bytes = new TextEncoder().encode(JSON.stringify(wire));
  const compressed = await pipeThrough(bytes, new CompressionStream('deflate-raw'));
  return toBase64Url(compressed);
}

/** Throws on malformed input. The returned team gets a fresh id. */
export async function decodeTeamShare(blob: string): Promise<Team> {
  const compressed = fromBase64Url(blob);
  const bytes = await pipeThrough(compressed, new DecompressionStream('deflate-raw'));
  const wire = JSON.parse(new TextDecoder().decode(bytes)) as WireTeam;
  if (wire.v !== 1 || !Array.isArray(wire.s)) throw new Error('unsupported share format');

  return {
    id: crypto.randomUUID(),
    name: String(wire.n || 'Shared team').slice(0, 60),
    regulation: String(wire.r || 'm-b'),
    format: wire.f === 'singles' ? 'singles' : 'doubles',
    sets: wire.s.slice(0, 6).map((w): ChampionsSet => {
      const sp = { ...EMPTY_SP };
      STAT_IDS.forEach((id, i) => {
        const v = Number(w.p?.[i] ?? 0);
        sp[id] = Number.isFinite(v) ? Math.max(0, Math.min(32, Math.round(v))) : 0;
      });
      return {
        species: String(w.sp),
        ...(w.mg ? { megaStone: String(w.mg) } : {}),
        ability: String(w.ab ?? ''),
        ...(w.it ? { item: String(w.it) } : {}),
        alignment: (w.al ?? 'Serious') as ChampionsSet['alignment'],
        sp,
        moves: (w.mv ?? []).slice(0, 4).map(String) as ChampionsSet['moves'],
      };
    }),
  };
}

export function shareUrl(blob: string): string {
  return `${location.origin}${location.pathname}#share/${blob}`;
}
