'use client'

import { useEffect, useRef, useState } from 'react'
import 'leaflet/dist/leaflet.css'
import type { LayerGroup, Map as LeafletMap } from 'leaflet'
import { isUsableCenter, type LatLng } from '@/lib/geo'

/**
 * Mapa de zonas sobre OpenStreetMap.
 *
 * OpenStreetMap tiles need no API key, no billing account and no tax ID -- the
 * constraint every map provider had to meet here. Leaflet is loaded inside an
 * effect because it touches `window` at import time.
 *
 * Zone names are admin-entered text, so tooltips are built as DOM text nodes:
 * Leaflet renders a plain string tooltip as HTML.
 */

export interface MapZone {
  id: string
  name: string
  center?: LatLng | null
  /** Kilometers. */
  radius?: number
  active?: boolean
}

export interface MapPoint extends LatLng {
  outside?: boolean
  label?: string
}

interface ZoneMapProps {
  /** What the map shows, for assistive technology. */
  label: string
  zones?: readonly MapZone[]
  /** The zone being edited: drawn dashed, on top of the others. */
  draft?: { center: LatLng | null; radiusKm: number } | null
  points?: readonly MapPoint[]
  onPick?: (point: LatLng) => void
  height?: number
}

const CDMX: LatLng = { lat: 19.4326, lng: -99.1332 }
const TILE_URL = 'https://tile.openstreetmap.org/{z}/{x}/{y}.png'
const ATTRIBUTION = '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
const BRAND = '#c45100'
const MUTED = '#808897'
const DRAFT = '#0f766e'
const INSIDE = '#185abc'
const OUTSIDE = '#b42318'

function textNode(text: string): HTMLElement {
  const element = document.createElement('span')
  element.textContent = text
  return element
}

export default function ZoneMap({ label, zones = [], draft = null, points = [], onPick, height = 260 }: ZoneMapProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const mapRef = useRef<LeafletMap | null>(null)
  const layerRef = useRef<LayerGroup | null>(null)
  const leafletRef = useRef<typeof import('leaflet') | null>(null)
  const pickRef = useRef(onPick)
  const fittedKeyRef = useRef('')
  const [ready, setReady] = useState(false)

  useEffect(() => {
    pickRef.current = onPick
  }, [onPick])

  useEffect(() => {
    let cancelled = false
    let resizeTimer: number | undefined
    ;(async () => {
      const L = await import('leaflet')
      if (cancelled || !containerRef.current || mapRef.current) return
      leafletRef.current = L
      const map = L.map(containerRef.current, { zoomControl: true, attributionControl: true }).setView([CDMX.lat, CDMX.lng], 11)
      L.tileLayer(TILE_URL, { maxZoom: 19, attribution: ATTRIBUTION }).addTo(map)
      map.on('click', (event) => pickRef.current?.({ lat: event.latlng.lat, lng: event.latlng.lng }))
      layerRef.current = L.layerGroup().addTo(map)
      mapRef.current = map
      // Inside an animating modal the container can measure 0 at first.
      resizeTimer = window.setTimeout(() => map.invalidateSize(), 250)
      setReady(true)
    })()
    return () => {
      cancelled = true
      if (resizeTimer) window.clearTimeout(resizeTimer)
      mapRef.current?.remove()
      mapRef.current = null
      layerRef.current = null
    }
  }, [])

  useEffect(() => {
    const L = leafletRef.current
    const map = mapRef.current
    const layer = layerRef.current
    if (!ready || !L || !map || !layer) return

    layer.clearLayers()
    const bounds = L.latLngBounds([])

    for (const zone of zones) {
      if (!isUsableCenter(zone.center) || !zone.radius || zone.radius <= 0) continue
      const inactive = zone.active === false
      const circle = L.circle([zone.center.lat, zone.center.lng], {
        radius: zone.radius * 1000,
        color: inactive ? MUTED : BRAND,
        weight: 1.5,
        fillOpacity: inactive ? 0.04 : 0.1,
      })
      circle.bindTooltip(() => textNode(inactive ? `${zone.name} (inactiva)` : zone.name))
      circle.addTo(layer)
      bounds.extend(circle.getBounds())
    }

    const hasDraft = Boolean(draft && isUsableCenter(draft.center))
    if (draft && isUsableCenter(draft.center)) {
      if (draft.radiusKm > 0) {
        const circle = L.circle([draft.center.lat, draft.center.lng], {
          radius: draft.radiusKm * 1000,
          color: DRAFT,
          weight: 2,
          dashArray: '6 4',
          fillOpacity: 0.12,
        }).addTo(layer)
        bounds.extend(circle.getBounds())
      } else {
        bounds.extend([draft.center.lat, draft.center.lng])
      }
      L.circleMarker([draft.center.lat, draft.center.lng], { radius: 5, color: DRAFT, fillColor: DRAFT, fillOpacity: 1 }).addTo(layer)
    }

    for (const point of points) {
      const marker = L.circleMarker([point.lat, point.lng], {
        radius: 4,
        weight: 1,
        color: point.outside ? OUTSIDE : INSIDE,
        fillColor: point.outside ? OUTSIDE : INSIDE,
        fillOpacity: 0.9,
      })
      if (point.label) marker.bindTooltip(() => textNode(point.label as string))
      marker.addTo(layer)
      bounds.extend([point.lat, point.lng])
    }

    // Fit once per set of things shown, not on every click: re-centering while
    // the admin is placing a zone would move the ground under their finger.
    const fitKey = `${zones.map((zone) => zone.id).join(',')}|${points.length}|${hasDraft ? 'draft' : ''}`
    if (bounds.isValid() && fittedKeyRef.current !== fitKey) {
      map.fitBounds(bounds, { padding: [24, 24], maxZoom: 15 })
      fittedKeyRef.current = fitKey
    }
  }, [ready, zones, draft, points])

  return (
    <div
      ref={containerRef}
      role="region"
      aria-label={label}
      className="z-0 w-full overflow-hidden rounded-2xl border border-ink/[0.08] bg-ink/[0.03]"
      style={{ height }}
    />
  )
}
