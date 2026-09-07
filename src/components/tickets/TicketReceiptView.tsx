import type { PersistentTicketSnapshot } from '@/lib/finance/domain'
import PetApDogMark from './PetApDogMark'

export default function TicketReceiptView({ ticket }: { ticket: PersistentTicketSnapshot }) {
  return (
    <section className="mx-auto w-full max-w-[384px] overflow-hidden rounded-sm bg-white px-6 py-8 font-mono text-[12px] leading-relaxed text-black shadow-[0_14px_40px_rgba(15,23,42,0.14)]" aria-label="Recibo interno PET Ap">
      <header className="flex flex-col items-center text-center">
        <PetApDogMark className="mb-2 h-16 w-[76px]" />
        <p className="text-xl font-black tracking-tight">PET Ap</p>
        <p className="mt-0.5 text-[11px] font-bold tracking-[0.16em]">PASEO COMPLETADO</p>
      </header>
      <div className="my-4 border-t border-dashed border-black/60" aria-hidden="true" />
      <div className="space-y-1">
        <p className="text-sm font-black">{ticket.dogIds.map((dogId) => ticket.dogNames[dogId]).join(', ')}</p>
        <p>{ticket.serviceName}{ticket.durationMinutes ? ` · ${ticket.durationMinutes} min` : ''}</p>
        <p>{ticket.serviceDate} · {ticket.startTime}{ticket.endTime ? `–${ticket.endTime}` : ''}</p>
      </div>
      <dl className="mt-4 space-y-1">
        <div className="flex gap-2"><dt className="shrink-0 font-bold">Paseador</dt><dd className="min-w-0 break-words">{ticket.walkerName}</dd></div>
        <div><dt className="font-bold">Folio</dt><dd className="break-all text-[11px]">{ticket.folio}</dd></div>
        <div><dt className="font-bold">Servicio</dt><dd className="break-all text-[11px]">{ticket.serviceFolio}</dd></div>
      </dl>
      <p className="mt-4 border-y border-dashed border-black/60 py-3 text-center font-black">PAGO NO REGISTRADO</p>
      <div className="text-center">
        <p className="mt-4 font-bold tracking-wide">VER REPORTE DEL PASEO</p>
        <div className="mx-auto my-3 grid h-24 w-24 grid-cols-5 gap-1 bg-black p-2" aria-label="Representación visual del QR">
          {Array.from({ length: 25 }, (_, index) => <span key={index} className={index % 3 === 0 || index % 7 === 0 ? 'bg-white' : 'bg-black'} />)}
        </div>
        <p>{new URL(ticket.reportUrl).hostname}</p>
        <p className="mt-2">Verif: {ticket.verificationCode}</p>
        <p className="mt-4 font-black">RECIBO INTERNO · NO CFDI</p>
        <p className="mt-3">¡Gracias por confiar en PET Ap!</p>
      </div>
    </section>
  )
}
