import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { EVENT_TYPES } from '@/lib/constants'
import { Loader2 } from 'lucide-react'

const inquirySchema = z.object({
  client_name: z.string().min(1, 'Client name is required'),
  client_phone: z.string().min(10, 'Phone must be at least 10 digits'),
  event_type: z.string().min(1, 'Event type is required'),
  event_date: z.string().optional(),
  pax: z.number().min(1).optional(),
  budget: z.number().min(0).optional(),
  follow_up_date: z.string().optional(),
  remarks: z.string().optional(),
})

type InquiryFormData = z.infer<typeof inquirySchema>

interface InquiryFormProps {
  initialData?: Partial<InquiryFormData>
  onSubmit: (data: InquiryFormData) => void
  loading?: boolean
}

export function InquiryForm({ initialData, onSubmit, loading }: InquiryFormProps) {
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<InquiryFormData>({
    resolver: zodResolver(inquirySchema),
    defaultValues: initialData,
  })

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="grid grid-cols-1 gap-4 md:grid-cols-2">
      <div>
        <label className="mb-1 block text-sm font-medium text-gray-700">Client Name *</label>
        <input
          {...register('client_name')}
          className="h-10 w-full rounded-lg border border-gray-200 px-3 text-sm"
        />
        {errors.client_name && (
          <p className="mt-1 text-xs text-red-500">{errors.client_name.message}</p>
        )}
      </div>

      <div>
        <label className="mb-1 block text-sm font-medium text-gray-700">Phone *</label>
        <input
          {...register('client_phone')}
          className="h-10 w-full rounded-lg border border-gray-200 px-3 text-sm"
        />
        {errors.client_phone && (
          <p className="mt-1 text-xs text-red-500">{errors.client_phone.message}</p>
        )}
      </div>

      <div>
        <label className="mb-1 block text-sm font-medium text-gray-700">Event Type *</label>
        <select
          {...register('event_type')}
          className="h-10 w-full rounded-lg border border-gray-200 px-3 text-sm"
        >
          <option value="">Select type</option>
          {EVENT_TYPES.map((t) => (
            <option key={t} value={t}>
              {t}
            </option>
          ))}
        </select>
        {errors.event_type && (
          <p className="mt-1 text-xs text-red-500">{errors.event_type.message}</p>
        )}
      </div>

      <div>
        <label className="mb-1 block text-sm font-medium text-gray-700">Event Date</label>
        <input
          {...register('event_date')}
          type="date"
          className="h-10 w-full rounded-lg border border-gray-200 px-3 text-sm"
        />
      </div>

      <div>
        <label className="mb-1 block text-sm font-medium text-gray-700">Pax (Guests)</label>
        <input
          {...register('pax')}
          type="number"
          className="h-10 w-full rounded-lg border border-gray-200 px-3 text-sm"
        />
      </div>

      <div>
        <label className="mb-1 block text-sm font-medium text-gray-700">Budget (₹)</label>
        <input
          {...register('budget')}
          type="number"
          className="h-10 w-full rounded-lg border border-gray-200 px-3 text-sm"
        />
      </div>

      <div>
        <label className="mb-1 block text-sm font-medium text-gray-700">Follow-up Date</label>
        <input
          {...register('follow_up_date')}
          type="date"
          className="h-10 w-full rounded-lg border border-gray-200 px-3 text-sm"
        />
      </div>

      <div>
        <label className="mb-1 block text-sm font-medium text-gray-700">Remarks</label>
        <input
          {...register('remarks')}
          className="h-10 w-full rounded-lg border border-gray-200 px-3 text-sm"
        />
      </div>

      <div className="flex justify-end md:col-span-2">
        <button
          type="submit"
          disabled={loading}
          className="flex h-10 items-center gap-2 rounded-lg bg-gold px-6 text-sm font-medium text-white shadow transition-colors hover:bg-gold-hover disabled:opacity-50"
        >
          {loading && <Loader2 className="h-4 w-4 animate-spin" />}
          Save Inquiry
        </button>
      </div>
    </form>
  )
}
