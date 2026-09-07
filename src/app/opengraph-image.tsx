import { ImageResponse } from 'next/og'

export const runtime = 'edge'
export const alt = 'PET Ap — Paseos caninos con tecnología'
export const size = { width: 1200, height: 630 }
export const contentType = 'image/png'

export default function Image() {
  return new ImageResponse(
    (
      <div
        style={{
          background: '#FFF8F1',
          width: '100%',
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'center',
          padding: '80px',
          position: 'relative',
        }}
      >
        {/* Accent bar */}
        <div
          style={{
            position: 'absolute',
            top: 0,
            left: 0,
            right: 0,
            height: 8,
            background: '#C45100',
          }}
        />
        <div
          style={{
            fontSize: 72,
            fontWeight: 900,
            color: '#172033',
            letterSpacing: '-0.02em',
            lineHeight: 1.1,
          }}
        >
          PET Ap
        </div>
        <div
          style={{
            fontSize: 32,
            color: '#5D6778',
            marginTop: 16,
            lineHeight: 1.4,
          }}
        >
          Paseos caninos con tecnología
        </div>
        <div
          style={{
            display: 'flex',
            gap: 16,
            marginTop: 40,
          }}
        >
          <div
            style={{
              background: '#C45100',
              color: 'white',
              padding: '12px 24px',
              borderRadius: 999,
              fontSize: 20,
              fontWeight: 600,
            }}
          >
            Entrar a Familia PET
          </div>
          <div
            style={{
              background: '#0F766E',
              color: 'white',
              padding: '12px 24px',
              borderRadius: 999,
              fontSize: 20,
              fontWeight: 600,
            }}
          >
            Conoce cómo funciona
          </div>
        </div>
        {/* Paw decoration */}
        <div
          style={{
            position: 'absolute',
            bottom: 40,
            right: 80,
            fontSize: 120,
            opacity: 0.1,
            color: '#C45100',
          }}
        >
          🐾
        </div>
      </div>
    ),
    { ...size }
  )
}
