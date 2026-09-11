/* eslint-disable react-refresh/only-export-components */

import { SVGProps } from 'react'

/**
 * Las marcas de redes, reconocibles.
 *
 * Instagram y TikTok se dibujaban como trazos genéricos -- un cuadrito con un
 * círculo y una nota musical -- y en el pie del sitio no se parecían a nada.
 * Estas son sus siluetas reales, en una sola forma rellena que hereda el color
 * del contexto, así que funcionan igual en claro y en oscuro.
 *
 * Aceptan `size` como los iconos de lucide, para poder intercambiarlos sin
 * tocar cada lugar donde se usan.
 */

type IconProps = SVGProps<SVGSVGElement> & { size?: number | string }

function svgProps({ size, width, height, ...rest }: IconProps): SVGProps<SVGSVGElement> {
  return { width: width ?? size ?? '1em', height: height ?? size ?? '1em', ...rest }
}

export function FacebookIcon(props: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" stroke="none" {...svgProps(props)}>
      <path d="M22 12.06C22 6.5 17.52 2 12 2S2 6.5 2 12.06c0 5 3.66 9.15 8.44 9.94v-7.03H7.9v-2.9h2.54V9.84c0-2.52 1.5-3.91 3.77-3.91 1.09 0 2.24.2 2.24.2v2.46h-1.26c-1.24 0-1.63.78-1.63 1.57v1.9h2.78l-.45 2.9h-2.33V22c4.78-.79 8.44-4.93 8.44-9.94Z" />
    </svg>
  )
}

export function InstagramIcon(props: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" stroke="none" {...svgProps(props)}>
      <path d="M12 2c2.7 0 3.06.01 4.12.06 1.06.05 1.79.22 2.42.46.66.26 1.21.6 1.76 1.15.55.55.89 1.1 1.15 1.76.24.63.41 1.36.46 2.42.05 1.06.06 1.42.06 4.15s-.01 3.09-.06 4.15c-.05 1.06-.22 1.79-.46 2.42a4.9 4.9 0 0 1-1.15 1.76 4.9 4.9 0 0 1-1.76 1.15c-.63.24-1.36.41-2.42.46-1.06.05-1.42.06-4.12.06s-3.06-.01-4.12-.06c-1.06-.05-1.79-.22-2.42-.46a4.9 4.9 0 0 1-1.76-1.15 4.9 4.9 0 0 1-1.15-1.76c-.24-.63-.41-1.36-.46-2.42C2.01 15.09 2 14.73 2 12s.01-3.09.06-4.15c.05-1.06.22-1.79.46-2.42.26-.66.6-1.21 1.15-1.76A4.9 4.9 0 0 1 5.43 2.52c.63-.24 1.36-.41 2.42-.46C8.91 2.01 9.27 2 12 2Zm0 1.8c-2.67 0-2.99.01-4.04.06-.97.05-1.5.21-1.85.35-.47.18-.8.4-1.15.75-.35.35-.57.68-.75 1.15-.14.35-.3.88-.35 1.85-.05 1.05-.06 1.37-.06 4.04s.01 2.99.06 4.04c.05.97.21 1.5.35 1.85.18.47.4.8.75 1.15.35.35.68.57 1.15.75.35.14.88.3 1.85.35 1.05.05 1.37.06 4.04.06s2.99-.01 4.04-.06c.97-.05 1.5-.21 1.85-.35.47-.18.8-.4 1.15-.75.35-.35.57-.68.75-1.15.14-.35.3-.88.35-1.85.05-1.05.06-1.37.06-4.04s-.01-2.99-.06-4.04c-.05-.97-.21-1.5-.35-1.85a3.1 3.1 0 0 0-.75-1.15 3.1 3.1 0 0 0-1.15-.75c-.35-.14-.88-.3-1.85-.35C14.99 3.81 14.67 3.8 12 3.8Zm0 3.07a5.13 5.13 0 1 1 0 10.26 5.13 5.13 0 0 1 0-10.26Zm0 1.8a3.33 3.33 0 1 0 0 6.66 3.33 3.33 0 0 0 0-6.66Zm5.34-3.2a1.2 1.2 0 1 1 0 2.4 1.2 1.2 0 0 1 0-2.4Z" />
    </svg>
  )
}

export function TikTokIcon(props: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" stroke="none" {...svgProps(props)}>
      <path d="M16.6 2h-3.2v13.4a2.7 2.7 0 1 1-2.2-2.65V9.5a6.06 6.06 0 1 0 5.4 6.02V8.9a7.3 7.3 0 0 0 4.3 1.38V7.05A4.36 4.36 0 0 1 16.6 2Z" />
    </svg>
  )
}

export function WhatsAppIcon(props: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" stroke="none" {...svgProps(props)}>
      <path d="M12.04 2a9.9 9.9 0 0 0-8.55 14.94L2 22l5.2-1.45A9.94 9.94 0 1 0 12.04 2Zm0 18.11a8.15 8.15 0 0 1-4.16-1.14l-.3-.18-3.09.86.86-3.01-.2-.31a8.16 8.16 0 1 1 6.89 3.78Zm4.48-6.11c-.25-.12-1.45-.72-1.68-.8-.22-.08-.39-.12-.55.12-.16.25-.63.8-.77.97-.14.16-.28.18-.53.06a6.65 6.65 0 0 1-3.32-2.91c-.25-.43.25-.4.72-1.34.08-.16.04-.3-.02-.43-.06-.12-.55-1.32-.75-1.8-.2-.47-.4-.41-.55-.42h-.47c-.16 0-.42.06-.64.3-.22.25-.84.82-.84 2 0 1.18.86 2.32.98 2.48.12.16 1.7 2.59 4.11 3.63.57.25 1.02.4 1.37.51.58.19 1.1.16 1.52.1.46-.07 1.45-.59 1.65-1.16.2-.57.2-1.06.14-1.16-.06-.1-.22-.16-.47-.28Z" />
    </svg>
  )
}

export const SocialIcons = {
  FacebookIcon,
  InstagramIcon,
  TikTokIcon,
  WhatsAppIcon,
}

export default { FacebookIcon, InstagramIcon, TikTokIcon, WhatsAppIcon }
