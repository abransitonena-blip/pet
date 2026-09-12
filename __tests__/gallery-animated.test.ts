import { readFileSync } from 'node:fs'
import {
  GALLERY_FORMATS,
  GALLERY_UPLOAD_TYPES,
  GALLERY_VIDEO_MAX_SECONDS,
  galleryMaxBytesForMime,
  galleryResourceKind,
  isGalleryAnimated,
  isGalleryVideo,
} from '@/lib/media/galleryMedia'

const read = (path: string) => readFileSync(path, 'utf8')

describe('formatos de la galería', () => {
  it('un video vive bajo otro tipo de recurso; un GIF sigue siendo imagen', () => {
    expect(galleryResourceKind('mp4')).toBe('video')
    expect(galleryResourceKind('webm')).toBe('video')
    expect(galleryResourceKind('gif')).toBe('image')
    expect(galleryResourceKind('jpg')).toBe('image')
  })

  it('se mueve el video y el GIF; una foto no', () => {
    expect(isGalleryAnimated('mp4')).toBe(true)
    expect(isGalleryAnimated('gif')).toBe(true)
    expect(isGalleryAnimated('jpg')).toBe(false)
    expect(isGalleryVideo('gif')).toBe(false)
  })

  it('el video puede pesar más que una foto, pero tiene su propio tope', () => {
    expect(galleryMaxBytesForMime('video/mp4')).toBeGreaterThan(galleryMaxBytesForMime('image/jpeg'))
    expect(GALLERY_VIDEO_MAX_SECONDS).toBeLessThanOrEqual(30)
  })

  it('lo que acepta el selector y lo que se guarda coinciden', () => {
    for (const mime of GALLERY_UPLOAD_TYPES) {
      const extension = mime.split('/')[1]
      expect(GALLERY_FORMATS).toContain(extension === 'jpeg' ? 'jpeg' : extension)
    }
  })
})

/**
 * La carga fallaba con "no tienes permiso" cuando se marcaban las dos casillas:
 * las reglas exigen que un registro nuevo entre como borrador privado, y el
 * cliente escribía `publicGalleryAllowed: consent && rights`.
 */
describe('carga de la galería', () => {
  it('un registro nuevo nace sin permiso de publicación', () => {
    const manager = read('src/components/gallery/AdminGalleryManager.tsx')
    expect(manager).toContain('publicGalleryAllowed: false,')
    expect(manager).not.toContain('publicGalleryAllowed: consent && rights')
  })

  it('las reglas siguen exigiendo que nazca como borrador privado', () => {
    const rules = read('firestore.rules')
    const block = rules.slice(rules.indexOf('match /gallery-images/{docId}'))
    expect(block.slice(0, 900)).toContain("request.resource.data.publicationStatus == 'draft'")
    expect(block.slice(0, 900)).toContain('request.resource.data.publicGalleryAllowed == false')
  })

  it('publicar es el paso aparte que lo enciende', () => {
    expect(read('src/components/gallery/AdminGalleryManager.tsx')).toContain("publicGalleryAllowed: status === 'published'")
  })
})

describe('lo animado se ve animado', () => {
  it('las reglas aceptan el URL de video y los formatos nuevos', () => {
    const rules = read('firestore.rules')
    expect(rules).toContain('(image|video)/upload/')
    expect(rules).toContain("'gif', 'mp4', 'webm'")
  })

  it('el video va en bucle, sin sonido y sin abrirse a pantalla completa', () => {
    const gallery = read('src/components/Gallery.tsx')
    for (const attribute of ['autoPlay', 'muted', 'loop', 'playsInline']) {
      expect(gallery).toContain(attribute)
    }
  })

  it('un GIF pasa sin optimizar, o se quedaría en el primer cuadro', () => {
    expect(read('src/components/Gallery.tsx')).toContain('unoptimized: isGalleryAnimated(format)')
  })

  it('la página comprueba el formato igual que las reglas', () => {
    expect(read('src/components/Gallery.tsx')).toContain('isGalleryFormat(data.format)')
  })

  it('la política escrita dice qué acepta la galería', () => {
    expect(read('MEDIA_POLICY.md')).toContain('video corto sin sonido')
  })
})
