import { BRAND } from '@/lib/brand'

/**
 * La marca es el perro, no una caja.
 *
 * The mark used to be a black-on-white PNG dropped inside a bordered white
 * tile, so on every screen it read as a sticker pasted on the page rather than
 * part of it -- and the dog itself was black, not the brand colour.
 *
 * `pet-ap-dog-mark.png` is the same silhouette with a real alpha channel and
 * the white margin trimmed off, used here as a CSS mask: the shape comes from
 * the file, the colour from `currentColor`. That means the mark inherits
 * whatever colour its context sets (brand orange on the page, white on a dark
 * header) and needs no container at all.
 */

function markStyle(size: number): React.CSSProperties {
  return {
    width: size,
    height: size,
    backgroundColor: 'currentColor',
    maskImage: `url(${BRAND.markPath})`,
    WebkitMaskImage: `url(${BRAND.markPath})`,
    maskRepeat: 'no-repeat',
    WebkitMaskRepeat: 'no-repeat',
    maskPosition: 'center',
    WebkitMaskPosition: 'center',
    maskSize: 'contain',
    WebkitMaskSize: 'contain',
  }
}

export function PawMark({ size = 20, className = '' }: { size?: number; className?: string }) {
  return <span aria-hidden="true" className={`block shrink-0 ${className}`} style={markStyle(size)} />
}

export function Logo({
  size = 36,
  className = '',
}: {
  size?: number
  /**
   * Kept for callers that used to round the removed tile; it now only styles
   * the mark itself, so passing a radius has no visible effect.
   */
  rounded?: string
  className?: string
}) {
  return (
    <span
      aria-hidden="true"
      className={`block shrink-0 text-primary ${className}`}
      style={markStyle(size)}
    />
  )
}
