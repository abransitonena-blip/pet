import PageHeader from '@/components/ui/PageHeader'
import LazyGalleryManager from './LazyGalleryManager'

export default function AdminGalleryPage() {
  return (
    <div className="space-y-6">
      <PageHeader title="Galería pública" description="Carga firmada, consentimiento y publicación controlada" />
      <LazyGalleryManager />
    </div>
  )
}
