/** Bundled Showdown gen5 sprite (see scripts/fetch-sprites.ts). */
export function Sprite({
  spriteId,
  size = 48,
  className = '',
}: {
  spriteId: string;
  size?: number;
  className?: string;
}) {
  return (
    <img
      src={`${import.meta.env.BASE_URL}sprites/${spriteId}.png`}
      width={size}
      height={size}
      alt=""
      loading="lazy"
      className={`select-none ${className}`}
      style={{ imageRendering: 'pixelated' }}
      draggable={false}
    />
  );
}
