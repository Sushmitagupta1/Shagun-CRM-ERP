import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { EVENT_TYPES } from '@/lib/constants'
import { Loader2, ArrowRight, CheckCircle2, ChevronLeft } from 'lucide-react'

const stage1Schema = z.object({
  client_name: z.string().min(1, 'Client name is required'),
  client_phone: z.string().min(10, 'Phone must be at least 10 digits'),
  event_type: z.string().min(1, 'Event type is required'),
  inquiry_date: z.string().optional(),
  event_date: z.string().optional(),
  pax: z.number().min(1).optional(),
  follow_up_date: z.string().optional(),
  remarks: z.string().optional(),
})

const stage2Schema = z.object({
  per_plate_rate: z.number().min(0).optional(),
  add_on: z.number().min(0).optional(),
  advance_amount: z.number().min(0).optional(),
  method: z.string().optional(),
  method_details: z.string().optional(),
  advance_payment_date: z.string().optional(),
  remaining_payment_date: z.string().optional(),
})

type Stage1Data = z.infer<typeof stage1Schema>
type Stage2Data = z.infer<typeof stage2Schema>

interface InquiryFormProps {
  onStage1Submit: (data: Stage1Data) => Promise<string>
  onStage2Submit: (id: string, data: Stage2Data) => Promise<void>
}

export function InquiryForm({ onStage1Submit, onStage2Submit }: InquiryFormProps) {
  const [step, setStep] = useState(1)
  const [stage1Data, setStage1Data] = useState<Stage1Data | null>(null)
  const [createdId, setCreatedId] = useState<string | null>(null)
  const [stage1Loading, setStage1Loading] = useState(false)
  const [stage2Loading, setStage2Loading] = useState(false)

  const stage1Form = useForm<Stage1Data>({
    resolver: zodResolver(stage1Schema),
  })

  const stage2Form = useForm<Stage2Data>()

  const { formState: { errors: errors1 } } = stage1Form

  const handleStage1Next = stage1Form.handleSubmit(async (data) => {
    setStage1Loading(true)
    try {
      const id = await onStage1Submit(data)
      setStage1Data(data)
      setCreatedId(id)
      setStep(2)
    } catch {
    } finally {
      setStage1Loading(false)
    }
  })

  const handleStage2Save = stage2Form.handleSubmit(async (stage2) => {
    if (!createdId) return
    setStage2Loading(true)
    try {
      await onStage2Submit(createdId, stage2)
      setStep(1)
      setStage1Data(null)
      setCreatedId(null)
      stage1Form.reset()
      stage2Form.reset()
    } catch {
    } finally {
      setStage2Loading(false)
    }
  })

  if (step === 2 && stage1Data) {
    return (
      <div>
        <div className="mb-4 flex items-center gap-2">
          <button type="button" onClick={() => setStep(1)}
            className="flex h-8 items-center gap-1 rounded-lg border border-gray-200 px-3 text-xs font-medium hover:bg-gray-50">
            <ChevronLeft size={14} /> Back
          </button>
          <span className="text-xs text-gray-400">Step 2 of 2 — Confirmation & Payment</span>
        </div>

        <div className="mb-4 rounded-lg border border-emerald-200 bg-emerald-50 p-3">
          <div className="mb-2 flex items-center gap-1.5 text-xs font-semibold text-emerald-700">
            <CheckCircle2 size={14} /> Stage 1 Confirmed
          </div>
          <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-xs text-gray-600">
            <p><span className="font-medium text-gray-900">Client:</span> {stage1Data.client_name}</p>
            <p><span className="font-medium text-gray-900">Phone:</span> {stage1Data.client_phone}</p>
            <p><span className="font-medium text-gray-900">Event:</span> {stage1Data.event_type}</p>
            <p><span className="font-medium text-gray-900">Pax:</span> {stage1Data.pax || '—'}</p>
            <p><span className="font-medium text-gray-900">Date:</span> {stage1Data.event_date || '—'}</p>
          </div>
        </div>

        <form onSubmit={handleStage2Save} className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700">Per Plate Rate (₹)</label>
            <input {...stage2Form.register('per_plate_rate', { valueAsNumber: true })} type="number"
              className="h-10 w-full rounded-lg border border-gray-200 px-3 text-sm" />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700">Add-ons (₹)</label>
            <input {...stage2Form.register('add_on', { valueAsNumber: true })} type="number" placeholder="Extra charges"
              className="h-10 w-full rounded-lg border border-gray-200 px-3 text-sm" />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700">Advance Amount (₹)</label>
            <input {...stage2Form.register('advance_amount', { valueAsNumber: true })} type="number"
              className="h-10 w-full rounded-lg border border-gray-200 px-3 text-sm" />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700">Payment Method</label>
            <input {...stage2Form.register('method')}
              placeholder="e.g. Cash, UPI, Bank Transfer"
              className="h-10 w-full rounded-lg border border-gray-200 px-3 text-sm" />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700">Method Details</label>
            <input {...stage2Form.register('method_details')}
              className="h-10 w-full rounded-lg border border-gray-200 px-3 text-sm" />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700">Advance Payment Date</label>
            <input {...stage2Form.register('advance_payment_date')} type="date"
              className="h-10 w-full rounded-lg border border-gray-200 px-3 text-sm" />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700">Remaining Payment Due Date</label>
            <input {...stage2Form.register('remaining_payment_date')} type="date"
              className="h-10 w-full rounded-lg border border-gray-200 px-3 text-sm" />
          </div>
          <div className="flex justify-end md:col-span-2">
            <button type="submit" disabled={stage2Loading}
              className="flex h-10 items-center gap-2 rounded-lg bg-gold px-6 text-sm font-medium text-white shadow transition-colors hover:bg-gold-hover disabled:opacity-50">
              {stage2Loading && <Loader2 className="h-4 w-4 animate-spin" />}
              Save Inquiry
            </button>
          </div>
        </form>
      </div>
    )
  }

  return (
    <form onSubmit={handleStage1Next} className="grid grid-cols-1 gap-4 md:grid-cols-2">
      <div>
        <label className="mb-1 block text-sm font-medium text-gray-700">Client Name *</label>
        <input {...stage1Form.register('client_name')}
          className="h-10 w-full rounded-lg border border-gray-200 px-3 text-sm" />
        {errors1.client_name && <p className="mt-1 text-xs text-red-500">{errors1.client_name.message}</p>}
      </div>
      <div>
        <label className="mb-1 block text-sm font-medium text-gray-700">Phone *</label>
        <input {...stage1Form.register('client_phone')}
          className="h-10 w-full rounded-lg border border-gray-200 px-3 text-sm" />
        {errors1.client_phone && <p className="mt-1 text-xs text-red-500">{errors1.client_phone.message}</p>}
      </div>
      <div>
        <label className="mb-1 block text-sm font-medium text-gray-700">Event Type *</label>
        <input {...stage1Form.register('event_type')} list="event-types" placeholder="e.g. Wedding"
          className="h-10 w-full rounded-lg border border-gray-200 px-3 text-sm" />
        <datalist id="event-types">
          {EVENT_TYPES.map((t) => <option key={t} value={t} />)}
        </datalist>
        {errors1.event_type && <p className="mt-1 text-xs text-red-500">{errors1.event_type.message}</p>}
      </div>
      <div>
        <label className="mb-1 block text-sm font-medium text-gray-700">Inquiry Date</label>
        <input {...stage1Form.register('inquiry_date')} type="date"
          className="h-10 w-full rounded-lg border border-gray-200 px-3 text-sm" />
      </div>
      <div>
        <label className="mb-1 block text-sm font-medium text-gray-700">Event Date</label>
        <input {...stage1Form.register('event_date')} type="date"
          className="h-10 w-full rounded-lg border border-gray-200 px-3 text-sm" />
      </div>
      <div>
        <label className="mb-1 block text-sm font-medium text-gray-700">Pax (Guests)</label>
        <input {...stage1Form.register('pax', { valueAsNumber: true })} type="number"
          className="h-10 w-full rounded-lg border border-gray-200 px-3 text-sm" />
      </div>
      <div>
        <label className="mb-1 block text-sm font-medium text-gray-700">Follow-up Date</label>
        <input {...stage1Form.register('follow_up_date')} type="date"
          className="h-10 w-full rounded-lg border border-gray-200 px-3 text-sm" />
      </div>
      <div>
        <label className="mb-1 block text-sm font-medium text-gray-700">Remarks</label>
        <input {...stage1Form.register('remarks')}
          className="h-10 w-full rounded-lg border border-gray-200 px-3 text-sm" />
      </div>
      <div className="flex justify-end md:col-span-2">
        <button type="submit" disabled={stage1Loading}
          className="flex h-10 items-center gap-2 rounded-lg bg-gold px-6 text-sm font-medium text-white shadow transition-colors hover:bg-gold-hover disabled:opacity-50">
          {stage1Loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <><ArrowRight size={16} /> Next</>}
        </button>
      </div>
    </form>
  )
}
