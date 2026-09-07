import PageHeader from '@/components/ui/PageHeader'
import AdminGalleryManager from '@/components/gallery/AdminGalleryManager'

export default function AdminGalleryPage() {
  return (
    <div className="space-y-6">
      <PageHeader title="Galería pública" description="Carga firmada, consentimiento y publicación controlada" />
      <AdminGalleryManager />
    </div>
  )
}
