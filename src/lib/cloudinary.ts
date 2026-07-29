export async function uploadToCloudinary(file: File, folder: string): Promise<string> {
  const formData = new FormData()
  formData.append('file', file)
  formData.append('upload_preset', 'pet_gallery')
  formData.append('folder', folder)

  const res = await fetch('https://api.cloudinary.com/v1_1/ktyauicg/image/upload', {
    method: 'POST',
    body: formData,
  })

  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    throw new Error(err.error?.message || `Error ${res.status} al subir a Cloudinary`)
  }

  const data = await res.json()
  return data.secure_url as string
}

export async function getCurrentPosition(): Promise<{ lat: number; lng: number }> {
  return new Promise((resolve, reject) => {
    if (!navigator.geolocation) reject(new Error('Geolocalización no disponible'))
    navigator.geolocation.getCurrentPosition(
      (pos) => resolve({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
      () => reject(new Error('No se pudo obtener ubicación')),
      { enableHighAccuracy: true, timeout: 10000 },
    )
  })
}
