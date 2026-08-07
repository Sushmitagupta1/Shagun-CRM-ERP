import { useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { getInquiry } from '@/api/inquiries'
import { createMenuTemplate } from '@/api/menu'
import { updateInquiry } from '@/api/inquiries'
import { generateMenu } from '@/lib/gemini'
import { getTemplateCategories, getTemplateUrl } from '@/api/templates'
import PageHeader from '@/components/common/PageHeader'
import { toast } from 'sonner'
import { motion } from 'framer-motion'
import { ArrowLeft, Sparkles, Save, Download, RotateCcw, Loader2, CheckCircle2, BookOpen, Phone, Calendar, DollarSign, MessageSquare, FileText, User, Users, Layout } from 'lucide-react'
import { formatCurrency } from '@/lib/utils'
import { INQUIRY_STATUSES, PAYMENT_STATUSES } from '@/lib/constants'

interface MenuOption {
  id: string
  name: string
  content: string
  gradient: string
}

export default function MenuGenerator() {
  const { inquiryId } = useParams()
  const navigate = useNavigate()
  const [dishes, setDishes] = useState('')
  const [prompt, setPrompt] = useState('')
  const [generating, setGenerating] = useState(false)
  const [options, setOptions] = useState<MenuOption[]>([])
  const [selectedIdx, setSelectedIdx] = useState<number | null>(null)
  const [savingLibrary, setSavingLibrary] = useState(false)
  const [savingClient, setSavingClient] = useState(false)

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

  const handleGenerate = async () => {
    if (!inquiry) return
    setGenerating(true)
    setOptions([])
    setSelectedIdx(null)

    const promptText = [
      `Generate 3 different pure-veg menu options for ${inquiry.client_name}'s ${inquiry.event_type} event.`,
      `Guests: ${inquiry.pax || 'N/A'}, Per plate budget: ${inquiry.per_plate_rate ? formatCurrency(Number(inquiry.per_plate_rate)) : 'Flexible'}`,
      dishes ? `Client suggested dishes: ${dishes}` : '',
      prompt ? `Additional instructions: ${prompt}` : '',
      'Return exactly 3 menus separated by "---MENU---". Each menu should have a name on the first line like "**Menu Name**" followed by the dishes list.',
    ].filter(Boolean).join('\n')

    const res = await generateMenu({
      season: 'All',
      budget: inquiry.per_plate_rate ? String(inquiry.per_plate_rate) : '',
      guests: String(inquiry.pax || ''),
      eventType: inquiry.event_type,
      customPrompt: promptText,
    })

    if (res.error) {
      toast.error('AI error: ' + res.error)
      setGenerating(false)
      return
    }

    const gradients = ['from-amber-600 to-orange-700', 'from-emerald-600 to-teal-700', 'from-rose-600 to-red-700']
    const parts = res.text.split('---MENU---').filter(Boolean)
    const menuOptions: MenuOption[] = parts.map((part, i) => ({
      id: `opt_${i}`,
      name: part.match(/\*\*(.*?)\*\*/)?.[1] || `Menu Option ${i + 1}`,
      content: part,
      gradient: gradients[i] || gradients[0],
    }))

    setOptions(menuOptions)
    setGenerating(false)
  }

  const handleSaveToLibrary = async (option: MenuOption) => {
    setSavingLibrary(true)
    try {
      const name = option.name
      const dishesList = option.content.replace(/\*\*(.*?)\*\*/g, '').split('\n').filter(Boolean)
      await createMenuTemplate({
        name,
        category: 'AI Generated',
        description: `AI-generated menu for ${inquiry?.client_name || 'unknown'}`,
        dish_count: dishesList.length,
        gradient: option.gradient,
        dishes: { items: dishesList },
      })
      toast.success('Saved to Menu Library')
    } catch {
      toast.error('Failed to save')
    } finally {
      setSavingLibrary(false)
    }
  }

  const handleSaveForClient = async (option: MenuOption) => {
    setSavingClient(true)
    try {
      const templateInfo = selectedFile ? `\nTemplate: ${selectedCat}/${selectedFile}` : ''
      const header = `Menu: ${option.name}\nClient: ${inquiry?.client_name}\nEvent: ${inquiry?.event_type}\nGuests: ${inquiry?.pax || 'N/A'}${templateInfo}\n${'='.repeat(40)}\n\n`
      await updateInquiry(inquiryId!, { menu_content: header + option.content, menu_uploaded: true })
      toast.success('Menu saved for ' + inquiry?.client_name)
    } catch {
      toast.error('Failed to save menu')
    } finally {
      setSavingClient(false)
    }
  }

  const handleRegenerate = async (idx: number) => {
    const option = options[idx]
    setGenerating(true)

    const res = await generateMenu({
      season: 'All',
      budget: inquiry?.per_plate_rate ? String(inquiry.per_plate_rate) : '',
      guests: String(inquiry?.pax || ''),
      eventType: inquiry?.event_type || '',
      customPrompt: `Regenerate a different version of this menu: ${option.content}. Make it unique with different dishes. Return only the new menu.`,
    })

    if (res.error) {
      toast.error('AI error: ' + res.error)
      setGenerating(false)
      return
    }

    const updated = [...options]
    updated[idx] = {
      ...updated[idx],
      content: res.text,
      name: res.text.match(/\*\*(.*?)\*\*/)?.[1] || `Menu Option ${idx + 1}`,
    }
    setOptions(updated)
    setGenerating(false)
  }

  const handleDownload = (option: MenuOption) => {
    const lines = option.content.replace(/\*\*(.*?)\*\*/g, '$1').split('\n').filter(Boolean)
    const dishesHtml = lines.slice(1).map((d) => `<li>${d}</li>`).join('')

    let style = ''
    let bodyStyle = ''
    if (selectedFile) {
      const imgUrl = getTemplateUrl(selectedCat, selectedFile)
      style = `
        .menu-bg { background-image: url('${imgUrl}'); background-size: 100% 100%; background-position: center; background-repeat: no-repeat; min-height: 100vh; }
        .menu-overlay { background: rgba(255,255,255,0.85); padding: 40px; margin: 40px auto; max-width: 700px; border-radius: 12px; }
      `
      bodyStyle = 'class="menu-bg"'
    }

    const html = `<html><head><style>
      body{font-family:Arial;padding:0;margin:0;color:#333}
      ${style}
      h1{color:#5A0016;border-bottom:2px solid #5A0016;padding-bottom:10px;font-size:24px}
      ul{list-style:none;padding:0;margin-top:20px;line-height:2.2}
      li{padding:4px 0;font-size:15px;border-bottom:1px solid #f0f0f0}
      .info{color:#666;font-size:13px;margin:4px 0}
      .footer{margin-top:40px;color:#999;font-size:11px;text-align:center}
    </style></head>
    <body ${bodyStyle}>
      <div${selectedFile ? ' class="menu-overlay"' : ' style="padding:40px;max-width:700px;margin:auto"'}>
        <h1>${option.name}</h1>
        <p class="info">${inquiry?.client_name} · ${inquiry?.event_type} · ${inquiry?.pax || 'N/A'} guests</p>
        <ul>${dishesHtml}</ul>
        <p class="footer">Generated by Shagun Caterers AI</p>
      </div>
    </body></html>`

    const win = window.open('', '_blank')
    if (win) { win.document.write(html); win.document.close(); win.focus() }
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

      {/* Inputs */}
      <div className="grid gap-4 lg:grid-cols-2">
        <div className="rounded-xl border border-gray-100 bg-white p-5 shadow-md">
          <label className="mb-2 block text-[11px] font-bold uppercase text-gray-500">Suggested Dishes</label>
          <textarea value={dishes} onChange={(e) => setDishes(e.target.value)}
            placeholder="e.g. Dal Baati, Gatte ki Sabzi, Laal Maans..."
            className="h-24 w-full rounded-lg border border-gray-200 p-3 text-sm focus:outline-none focus:ring-2 focus:ring-gold/30" />
        </div>
        <div className="rounded-xl border border-gray-100 bg-white p-5 shadow-md">
          <label className="mb-2 block text-[11px] font-bold uppercase text-gray-500">Menu Prompt</label>
          <textarea value={prompt} onChange={(e) => setPrompt(e.target.value)}
            placeholder="e.g. North Indian style, no onion-garlic, include a sweet dish..."
            className="h-24 w-full rounded-lg border border-gray-200 p-3 text-sm focus:outline-none focus:ring-2 focus:ring-gold/30" />
        </div>
      </div>

      {/* Generate Button */}
      <button onClick={handleGenerate} disabled={generating}
        className="flex h-11 w-full items-center justify-center gap-2 rounded-xl bg-maroon text-sm font-bold text-white shadow-lg transition-colors hover:bg-maroon-dark disabled:opacity-50">
        {generating ? <><Loader2 size={16} className="animate-spin" /> Generating 3 Options...</> : <><Sparkles size={16} /> Generate Menu Options</>}
      </button>

      {/* Options */}
      {options.length > 0 && (
        <div className="grid gap-4 lg:grid-cols-3">
          {options.map((opt, idx) => (
            <motion.div key={opt.id} initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: idx * 0.1 }}
              className={`overflow-hidden rounded-xl border shadow-md transition-all ${selectedIdx === idx ? 'ring-2 ring-gold' : 'border-gray-100'}`}>
              <div className={`h-2 bg-gradient-to-r ${opt.gradient}`} />
              <div className="p-4">
                <div className="mb-2 flex items-center justify-between">
                  <h3 className="text-sm font-bold text-gray-900">{opt.name}</h3>
                  {selectedIdx === idx && <CheckCircle2 size={16} className="text-gold" />}
                </div>
                <p className="mb-3 text-[11px] leading-relaxed text-gray-600">
                  {opt.content.replace(/\*\*(.*?)\*\*/g, '$1').split('\n').slice(1).join(', ')}
                </p>
                <div className="space-y-2">
                  <button onClick={() => handleSaveToLibrary(opt)} disabled={savingLibrary}
                    className="flex h-8 w-full items-center justify-center gap-1.5 rounded-lg border border-gray-200 text-[11px] font-medium text-gray-700 transition-colors hover:bg-gray-50 disabled:opacity-50">
                    <BookOpen size={12} /> {savingLibrary ? 'Saving...' : 'Save in Library'}
                  </button>
                  <button onClick={() => handleSaveForClient(opt)} disabled={savingClient}
                    className="flex h-8 w-full items-center justify-center gap-1.5 rounded-lg bg-maroon text-[11px] font-medium text-white transition-colors hover:bg-maroon-dark disabled:opacity-50">
                    <Save size={12} /> {savingClient ? 'Saving...' : 'Save for Client'}
                  </button>
                  <div className="grid grid-cols-2 gap-2">
                    <button onClick={() => handleRegenerate(idx)} disabled={generating}
                      className="flex h-7 items-center justify-center gap-1 rounded-lg border border-gray-200 text-[10px] font-medium text-gray-500 transition-colors hover:bg-gray-50 disabled:opacity-50">
                      <RotateCcw size={10} /> Regenerate
                    </button>
                    <button onClick={() => handleDownload(opt)}
                      className="flex h-7 items-center justify-center gap-1 rounded-lg border border-gray-200 text-[10px] font-medium text-gray-500 transition-colors hover:bg-gray-50">
                      <Download size={10} /> Preview
                    </button>
                  </div>
                </div>
              </div>
            </motion.div>
          ))}
        </div>
      )}
    </div>
  )
}
