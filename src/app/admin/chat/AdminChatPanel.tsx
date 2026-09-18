'use client'

import AdminChat from '@/components/AdminChat'
import PageHeader from '@/components/ui/PageHeader'

export default function AdminChatPage() {
  return (
    <div className="flex h-[calc(100vh-8rem)] flex-col">
      <PageHeader title="Chat" description="Hilos con familias, paseadores y paseos en curso" />
      <AdminChat />
    </div>
  )
}
