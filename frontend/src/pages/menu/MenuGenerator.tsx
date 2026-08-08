import { useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { getInquiry } from '@/api/inquiries'
import { generateMenuDesign, loadImageAsDataUrl } from '@/lib/groq'
import { parseMenuDesigns, downloadMenuDesignPdf, type MenuDesign } from '@/lib/menuDesign'
import { getTemplateCategories, getTemplateUrl } from '@/api/templates'
import PageHeader from '@/components/common/PageHeader'
import { toast } from 'sonner'
import { motion } from 'framer-motion'
import { ArrowLeft, Sparkles, RotateCcw, Loader2, Phone, Calendar, DollarSign, MessageSquare, FileText, User, Users, Layout, Palette, FileDown } from 'lucide-react'
import { formatCurrency } from '@/lib/utils'
import { INQUIRY_STATUSES, PAYMENT_STATUSES } from '@/lib/constants'

export default function MenuGenerator() {
  const { inquiryId } = useParams()
  const navigate = useNavigate()

  // AI Menu Designer
  const [designMenuText, setDesignMenuText] = useState('')
  const [designing, setDesigning] = useState(false)
  const [designs, setDesigns] = useState<MenuDesign[]>([])
  const [downloadingPdf, setDownloadingPdf] = useState<string | null>(null)

  // Template selection
  const [selectedCat, setSelectedCat] = useState('')
  const [selectedFile, setSelectedFile] = useState('')

  const { data: inquiry } = useQuery({
    queryKey: ['inquiry', inquiryId],
    queryFn: () => getInquiry(inquiryId!),
    enabled: !!inquiryId,
  })

  const { data: categories } = useQuery({
    queryKey: ['template-categories'],
    queryFn: getTemplateCategories,
  })

  const handleDesignMenu = async () => {
    if (!designMenuText.trim()) {
      toast.error('Paste your labeled menu first')
      return
    }
    if (!selectedCat || !selectedFile) {
      toast.error('Select a template first')
      return
    }
    setDesigning(true)
    setDesigns([])
    const templateImage = await loadImageAsDataUrl(getTemplateUrl(selectedCat, selectedFile))
    const res = await generateMenuDesign({
      menuText: designMenuText,
      eventType: inquiry?.event_type || 'General',
      clientName: inquiry?.client_name || 'Client',
      templateInfo: getTemplateUrl(selectedCat, selectedFile),
      templateImage,
    })
    if (res.error) {
      toast.error('AI error: ' + res.error)
      setDesigning(false)
      return
    }
    const parsed = parseMenuDesigns(res.text)
    if (parsed.error) {
      toast.error(parsed.error)
      setDesigning(false)
      return
    }
    setDesigns(parsed.designs)
    setDesigning(false)
    toast.success(`${parsed.designs.length} designs ready`)
  }

  const handleDownloadDesignPdf = async (design: MenuDesign) => {
    setDownloadingPdf(design.id)
    try {
      await downloadMenuDesignPdf(design, `${design.name.replace(/[^\w\d]+/g, '_')}.pdf`)
      toast.success('PDF downloaded')
    } catch {
      toast.error('Failed to generate PDF')
    } finally {
      setDownloadingPdf(null)
    }
  }

  const handleRegenerateDesign = (idx: number) => {
    setDesigns((prev) => prev.filter((_, i) => i !== idx))
  }

  if (!inquiry) {
    return <div className="flex h-64 items-center justify-center"><Loader2 size={24} className="animate-spin text-gold" /></div>
  }

  return (
    <div className="space-y-6">
      <PageHeader title={`Menu Generator — ${inquiry.client_name}`}
        subtitle={`${inquiry.event_type} · ${inquiry.pax || '?'} guests`}
        action={
          <button onClick={() => navigate('/menu')}
            className="flex h-9 items-center gap-2 rounded-lg border border-gray-200 px-4 text-sm font-medium hover:bg-gray-50">
            <ArrowLeft className="h-4 w-4" /> Back
          </button>
        }
      />

      {/* Inquiry Details */}
      <div className="rounded-xl border border-gray-100 bg-white p-5 shadow-md">
        <div className="mb-3 flex items-center gap-2">
          <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-maroon/10">
            <FileText size={14} className="text-maroon" />
          </div>
          <h3 className="text-xs font-bold uppercase tracking-wider text-gray-500">Inquiry Details</h3>
        </div>
        <div className="grid grid-cols-2 gap-x-6 gap-y-3 text-sm lg:grid-cols-3 xl:grid-cols-4">
          <div>
            <span className="flex items-center gap-1 text-[10px] font-bold uppercase text-gray-400"><User size={11} /> Client</span>
            <p className="font-semibold text-gray-900">{inquiry.client_name}</p>
          </div>
          <div>
            <span className="flex items-center gap-1 text-[10px] font-bold uppercase text-gray-400"><Phone size={11} /> Phone</span>
            <p className="text-gray-700">{inquiry.client_phone}</p>
          </div>
          <div>
            <span className="flex items-center gap-1 text-[10px] font-bold uppercase text-gray-400"><Sparkles size={11} /> Event</span>
            <p className="text-gray-700">{inquiry.event_type}</p>
          </div>
          <div>
            <span className="flex items-center gap-1 text-[10px] font-bold uppercase text-gray-400"><Users size={11} /> Guests</span>
            <p className="text-gray-700">{inquiry.pax ?? '—'}</p>
          </div>
          <div>
            <span className="flex items-center gap-1 text-[10px] font-bold uppercase text-gray-400"><DollarSign size={11} /> Per Plate</span>
            <p className="text-gray-700">{inquiry.per_plate_rate ? formatCurrency(Number(inquiry.per_plate_rate)) : '—'}</p>
          </div>
          <div>
            <span className="flex items-center gap-1 text-[10px] font-bold uppercase text-gray-400"><DollarSign size={11} /> Add On</span>
            <p className="text-gray-700">{inquiry.add_on ? formatCurrency(Number(inquiry.add_on)) : '—'}</p>
          </div>
          <div>
            <span className="flex items-center gap-1 text-[10px] font-bold uppercase text-gray-400"><DollarSign size={11} /> Total Amount</span>
            <p className="font-semibold text-gray-900">{inquiry.total_amount ? formatCurrency(Number(inquiry.total_amount)) : '—'}</p>
          </div>
          <div>
            <span className="flex items-center gap-1 text-[10px] font-bold uppercase text-gray-400"><Calendar size={11} /> Event Date</span>
            <p className="text-gray-700">{inquiry.event_date ?? '—'}</p>
          </div>
          <div>
            <span className="flex items-center gap-1 text-[10px] font-bold uppercase text-gray-400"><Calendar size={11} /> Inquiry Date</span>
            <p className="text-gray-700">{inquiry.inquiry_date ?? '—'}</p>
          </div>
          <div>
            <span className="flex items-center gap-1 text-[10px] font-bold uppercase text-gray-400">Pax</span>
            <p className="text-gray-700">{inquiry.pax ?? '—'}</p>
          </div>
          <div>
            <span className="flex items-center gap-1 text-[10px] font-bold uppercase text-gray-400">Status</span>
            <span className={`inline-block rounded-full px-2.5 py-0.5 text-[11px] font-medium ${INQUIRY_STATUSES[inquiry.status as keyof typeof INQUIRY_STATUSES]?.color || 'bg-gray-100 text-gray-700'}`}>
              {INQUIRY_STATUSES[inquiry.status as keyof typeof INQUIRY_STATUSES]?.label || inquiry.status}
            </span>
          </div>
          <div>
            <span className="flex items-center gap-1 text-[10px] font-bold uppercase text-gray-400">Payment</span>
            <span className={`inline-block rounded-full px-2.5 py-0.5 text-[11px] font-medium ${PAYMENT_STATUSES[inquiry.payment_status as keyof typeof PAYMENT_STATUSES]?.color || 'bg-gray-100 text-gray-700'}`}>
              {PAYMENT_STATUSES[inquiry.payment_status as keyof typeof PAYMENT_STATUSES]?.label || inquiry.payment_status}
            </span>
          </div>
          {inquiry.advance_amount ? (
            <div>
              <span className="flex items-center gap-1 text-[10px] font-bold uppercase text-gray-400"><DollarSign size={11} /> Advance</span>
              <p className="text-gray-700">{formatCurrency(Number(inquiry.advance_amount))}</p>
            </div>
          ) : null}
          {inquiry.remarks ? (
            <div className="col-span-full">
              <span className="flex items-center gap-1 text-[10px] font-bold uppercase text-gray-400"><MessageSquare size={11} /> Remarks</span>
              <p className="text-gray-700">{inquiry.remarks}</p>
            </div>
          ) : null}
        </div>
      </div>

      {/* Template Selection */}
      {categories && categories.length > 0 && (
        <div className="rounded-xl border border-gray-100 bg-white p-5 shadow-md">
          <div className="mb-3 flex items-center gap-2">
            <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-purple-50">
              <Layout size={14} className="text-purple-500" />
            </div>
            <h3 className="text-xs font-bold uppercase tracking-wider text-gray-500">Choose Menu Template</h3>
          </div>
          {/* Category Tabs */}
          <div className="mb-3 flex flex-wrap gap-2">
            {categories.map((cat) => (
              <button key={cat.name} onClick={() => { setSelectedCat(cat.name); setSelectedFile('') }}
                className={`rounded-lg px-3 py-1.5 text-xs font-medium transition-colors ${selectedCat === cat.name ? 'bg-maroon text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}>
                {cat.name} ({cat.count})
              </button>
            ))}
          </div>
          {/* Template Files Grid */}
          {selectedCat && (() => {
            const cat = categories.find((c) => c.name === selectedCat)
            return cat ? (
              <div className="grid grid-cols-3 gap-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6">
                {cat.files.map((f) => {
                  const isSelected = selectedFile === f
                  return (
                    <button key={f} onClick={() => setSelectedFile(f)}
                      className={`overflow-hidden rounded-lg border-2 transition-all ${isSelected ? 'border-gold ring-2 ring-gold/30' : 'border-gray-200 hover:border-gray-300'}`}>
                      <img src={getTemplateUrl(cat.name, f)} alt={f} className="h-20 w-full object-cover" />
                      <p className="truncate px-1 py-1 text-[9px] text-gray-500">{f}</p>
                    </button>
                  )
                })}
              </div>
            ) : null
          })()}
        </div>
      )}

      {/* AI Menu Designer */}
      <div className="rounded-xl border border-gray-100 bg-white p-5 shadow-md">
        <div className="mb-3 flex items-center gap-2">
          <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-gold/20">
            <Palette size={14} className="text-gold" />
          </div>
          <h3 className="text-xs font-bold uppercase tracking-wider text-gray-500">AI Menu Designer — Design on Template</h3>
        </div>
        <label className="mb-2 block text-[11px] font-bold uppercase text-gray-500">Labeled Menu List</label>
        <textarea value={designMenuText} onChange={(e) => setDesignMenuText(e.target.value)}
          placeholder={'STARTERS:\nPaneer Tikka\nHara Bhara Kebab\n\nMAIN COURSE:\nDal Makhani\nShahi Paneer\n\nDESSERTS:\nGulab Jamun\nRasmalai'}
          className="h-40 w-full rounded-lg border border-gray-200 p-3 font-mono text-sm focus:outline-none focus:ring-2 focus:ring-gold/30" />
        <button onClick={handleDesignMenu} disabled={designing}
          className="mt-3 flex h-11 w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-gold to-amber-600 text-sm font-bold text-white shadow-lg transition-colors hover:from-gold hover:to-amber-700 disabled:opacity-50">
          {designing ? <><Loader2 size={16} className="animate-spin" /> Designing 3 Options...</> : <><Palette size={16} /> Design Menu Picture</>}
        </button>
      </div>

      {/* Designer Options */}
      {designs.length > 0 && (
        <div className="space-y-4">
          <p className="text-xs font-bold uppercase tracking-wider text-gray-400">{designs.length} designs · select a template above, then re-run Design to change background</p>
          <div className="grid gap-4 lg:grid-cols-3">
            {designs.map((design, idx) => (
              <motion.div key={design.id} initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: idx * 0.1 }}
                className="overflow-hidden rounded-xl border border-gray-100 bg-white shadow-md">
                <div className="border-b border-gray-100 px-4 py-3">
                  <h4 className="text-sm font-bold text-gray-900">{design.name}</h4>
                  <p className="text-[10px] text-gray-400">{design.pages.length} page{design.pages.length > 1 ? 's' : ''} · A4</p>
                </div>
                <div className="max-h-96 overflow-y-auto border-b border-gray-100 bg-gray-50 p-3">
                  {design.pages.map((page, pi) => (
                    <div key={pi} className="mb-3 overflow-hidden rounded-lg shadow-sm last:mb-0"
                      dangerouslySetInnerHTML={{ __html: page.html }} />
                  ))}
                </div>
                <div className="grid grid-cols-2 gap-2 p-3">
                  <button onClick={() => handleDownloadDesignPdf(design)} disabled={downloadingPdf === design.id}
                    className="flex h-8 items-center justify-center gap-1.5 rounded-lg bg-maroon text-[11px] font-medium text-white transition-colors hover:bg-maroon-dark disabled:opacity-50">
                    {downloadingPdf === design.id ? <Loader2 size={12} className="animate-spin" /> : <FileDown size={12} />} Download PDF
                  </button>
                  <button onClick={() => handleRegenerateDesign(idx)}
                    className="flex h-8 items-center justify-center gap-1.5 rounded-lg border border-gray-200 text-[11px] font-medium text-gray-600 transition-colors hover:bg-gray-50">
                    <RotateCcw size={12} /> Regenerate
                  </button>
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
