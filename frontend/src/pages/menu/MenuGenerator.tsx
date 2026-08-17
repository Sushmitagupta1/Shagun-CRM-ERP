import { useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { getInquiry } from '@/api/inquiries'
import { generateMenuDesign, loadImageAsDataUrl, polishMenuText } from '@/lib/ai'
import { parseMenuDesigns, downloadMenuDesignPdf, extractMenuEditable, applyMenuEdits, detectPageFonts, detectPageColors, scopeMenuHtml, sanitizeMenuHtml, buildWordPageHtml, extractTemplatePalette, groupWordLines, wordLinesToHtml, extractWordLinesFromHtml, FONT_OPTIONS, type MenuDesign, type MenuEditablePage, type MenuFonts, type MenuColors, type TemplatePalette, type WordLine } from '@/lib/menuDesign'
import { getTemplateCategories, getTemplateUrl, getTemplateThumbUrl } from '@/api/templates'
import { getMenuVersions, createMenuVersion, parseWordFile, downloadWordMenu } from '@/api/inquiries'
import PageHeader from '@/components/common/PageHeader'
import { toast } from 'sonner'
import { motion } from 'framer-motion'
import { ArrowLeft, Sparkles, RotateCcw, Loader2, Phone, Calendar, DollarSign, MessageSquare, FileText, User, Users, Layout, Palette, FileDown, Save, History, Eye, ChevronDown, ChevronUp, X, Pencil, Plus, Trash2, Upload } from 'lucide-react'
import { formatCurrency } from '@/lib/utils'
import { INQUIRY_STATUSES, PAYMENT_STATUSES } from '@/lib/constants'
import { getErrorMessage } from '@/lib/apiError'
import WordMenuEditor from '@/components/menu/WordMenuEditor'

// Renders one design page with its <style> scoped to a unique container, so
// multiple previews on screen cannot leak styles or fonts onto each other.
function PagePreview({ html, scopeId }: { html: string; scopeId: string }) {
  return (
    <div data-menu-scope={scopeId}>
      <div dangerouslySetInnerHTML={{ __html: scopeMenuHtml(html, scopeId) }} />
    </div>
  )
}

export default function MenuGenerator() {
  const { inquiryId } = useParams()
  const navigate = useNavigate()
  const queryClient = useQueryClient()

  // AI Menu Designer
  const [designMenuText, setDesignMenuText] = useState('')
  const [designing, setDesigning] = useState(false)
  const [designs, setDesigns] = useState<MenuDesign[]>([])
  const [downloadingPdf, setDownloadingPdf] = useState<string | null>(null)
  const [savingVersion, setSavingVersion] = useState(false)
  const [showHistory, setShowHistory] = useState(false)
  const [viewingVersion, setViewingVersion] = useState<number | null>(null)
  const [regeneratingIdx, setRegeneratingIdx] = useState<string | null>(null)
  const [editingDesignId, setEditingDesignId] = useState<string | null>(null)
  const [editDraft, setEditDraft] = useState<MenuEditablePage[]>([])
  const [editFonts, setEditFonts] = useState<MenuFonts>({ title: '', heading: '', item: '' })
  const [editColors, setEditColors] = useState<MenuColors>({ title: '', heading: '', item: '' })
  const [wordPalette, setWordPalette] = useState<TemplatePalette | null>(null)
  const [uploadingWord, setUploadingWord] = useState(false)
  const [downloadingWord, setDownloadingWord] = useState(false)
  const [editingWordDesignId, setEditingWordDesignId] = useState<string | null>(null)

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

  const { data: menuVersions = [], isLoading: versionsLoading } = useQuery({
    queryKey: ['menu-versions', inquiryId],
    queryFn: () => getMenuVersions(inquiryId!),
    enabled: !!inquiryId,
  })

  const saveVersionMutation = useMutation({
    mutationFn: () =>
      createMenuVersion(inquiryId!, {
        menu_text: designMenuText,
        designs: designs,
        template_category: selectedCat || null,
        template_file: selectedFile || null,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['menu-versions', inquiryId] })
      toast.success('Menu version saved')
    },
    onError: () => toast.error('Failed to save version'),
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
      const templateUrl = selectedCat && selectedFile ? getTemplateUrl(selectedCat, selectedFile) : undefined
      const inquiryData = inquiry ? {
        client_name: inquiry.client_name,
        client_phone: inquiry.client_phone,
        event_type: inquiry.event_type,
        event_date: inquiry.event_date,
        pax: inquiry.pax,
        venue: inquiry.venue,
        per_plate_rate: inquiry.per_plate_rate,
        add_on: inquiry.add_on,
        advance_amount: inquiry.advance_amount,
        total_amount: inquiry.total_amount,
        remarks: inquiry.remarks,
      } : undefined
      await downloadMenuDesignPdf(design, `${design.name.replace(/[^\w\d]+/g, '_')}.pdf`, inquiryData, templateUrl)
      toast.success('PDF downloaded')
    } catch {
      toast.error('Failed to generate PDF')
    } finally {
      setDownloadingPdf(null)
    }
  }

  const handleRegenerateDesign = async (design: MenuDesign) => {
    if (regeneratingIdx !== null) return
    setRegeneratingIdx(design.id)
    try {
      let templateImage: string | null = null
      if (selectedCat && selectedFile) {
        templateImage = await loadImageAsDataUrl(getTemplateUrl(selectedCat, selectedFile))
      }
      const paletteIdx = design.paletteIndex ?? 0
      const res = await generateMenuDesign({
        menuText: designMenuText,
        eventType: inquiry?.event_type || 'General',
        clientName: inquiry?.client_name || 'Client',
        templateInfo: selectedCat && selectedFile ? getTemplateUrl(selectedCat, selectedFile) : '',
        templateImage,
        count: 1,
        previousDesign: design.raw,
        paletteIndex: paletteIdx,
      })
      if (res.error) {
        toast.error('AI error: ' + res.error)
        return
      }
      const parsed = parseMenuDesigns(res.text, paletteIdx)
      if (parsed.error || parsed.designs.length === 0) {
        toast.error(parsed.error || 'AI returned no design. Try again.')
        return
      }
      const replacement = { ...parsed.designs[0], id: design.id }
      setDesigns((prev) => {
        const exists = prev.some((d) => d.id === design.id)
        return exists ? prev.map((d) => (d.id === design.id ? replacement : d)) : [...prev, replacement]
      })
      toast.success('Design regenerated')
    } finally {
      setRegeneratingIdx(null)
    }
  }

  const handleOpenEdit = (design: MenuDesign) => {
    setEditDraft(extractMenuEditable(design))
    setEditFonts(detectPageFonts(design.pages[0]?.html || ''))
    setEditColors(detectPageColors(design.pages[0]?.html || ''))
    setEditingDesignId(design.id)
  }

  const handleEditHeading = (pageIndex: number, headingKey: string, text: string) => {
    setEditDraft((prev) => prev.map((p) => (p.pageIndex === pageIndex
      ? { ...p, headings: p.headings.map((h) => (h.key === headingKey ? { ...h, text } : h)) }
      : p)))
  }

  const handleEditItem = (pageIndex: number, itemKey: string, text: string) => {
    setEditDraft((prev) => prev.map((p) => (p.pageIndex === pageIndex
      ? { ...p, items: p.items.map((it) => (it.key === itemKey ? { ...it, text } : it)) }
      : p)))
  }

  const handleEditDescription = (pageIndex: number, itemKey: string, text: string) => {
    setEditDraft((prev) => prev.map((p) => (p.pageIndex === pageIndex
      ? { ...p, items: p.items.map((it) => (it.key === itemKey ? { ...it, description: text } : it)) }
      : p)))
  }

  const handleAddItem = (pageIndex: number) => {
    setEditDraft((prev) => prev.map((p) => (p.pageIndex === pageIndex
      ? { ...p, items: [...p.items, { key: `${p.pageIndex}_new_${Date.now()}`, text: '', description: '' }] }
      : p)))
  }

  const handleRemoveItem = (pageIndex: number, itemKey: string) => {
    setEditDraft((prev) => prev.map((p) => (p.pageIndex === pageIndex
      ? { ...p, items: p.items.filter((it) => it.key !== itemKey) }
      : p)))
  }

  const handleSaveEdit = () => {
    const design = designs.find((d) => d.id === editingDesignId)
    if (!design) return
    setDesigns((prev) => prev.map((d) => (d.id === editingDesignId ? applyMenuEdits(d, editDraft, { fonts: editFonts, colors: editColors }) : d)))
    setEditingDesignId(null)
    setEditDraft([])
    toast.success('Design updated. Click "Save Version" to keep it.')
  }

  const handleLoadVersion = (version: typeof menuVersions[number]) => {
    if (version.menu_text) setDesignMenuText(version.menu_text)
    if (version.designs && version.designs.length > 0) {
      setDesigns(version.designs)
    }
    if (version.template_category) setSelectedCat(version.template_category)
    if (version.template_file) setSelectedFile(version.template_file)
    setShowHistory(false)
    toast.success(`Loaded version ${version.version}`)
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  const isHeadingText = (t: string) => t.length <= 40 && (t === t.toUpperCase() || t.endsWith(':'))

  const handleWordUpload = async (file?: File) => {
    if (!file) return
    if (!selectedCat || !selectedFile) {
      toast.error('Select a template first')
      return
    }
    setUploadingWord(true)
    try {
      const { lines } = await parseWordFile(file)
      const res = await polishMenuText(lines.map((l) => l.text).join('\n'))
      if (res.error) {
        toast.error('AI error: ' + res.error)
        return
      }
      const polished = (res.text || '').split('\n').map((t) => t.trim()).filter((t) => t.length > 0)
      const merged: WordLine[] = polished.length === lines.length
        ? lines.map((l, i) => ({ ...l, text: polished[i] }))
        : polished.map((t) => ({ text: t, is_heading: isHeadingText(t), page: 0 }))
      const grouped = groupWordLines(merged)
      const cleaned = sanitizeMenuHtml(wordLinesToHtml(grouped))
      const templateUrl = getTemplateUrl(selectedCat, selectedFile)
      const palette = await extractTemplatePalette(templateUrl)
      setWordPalette(palette)
      const design: MenuDesign = {
        id: `word_${Date.now()}`,
        name: 'Word Menu',
        pages: [{ html: buildWordPageHtml(cleaned, templateUrl, palette), index: 0 }],
        raw: cleaned,
        wordLines: grouped,
      }
      setDesigns([design])
      setDesignMenuText(grouped.map((l) => l.text).join('\n'))
      toast.success('Word menu imported — check the preview, edit if needed, then Download Word')
    } catch (err) {
      toast.error(getErrorMessage(err, 'Word file import failed'))
    } finally {
      setUploadingWord(false)
    }
  }

  const handleSaveWordEdit = (newLines: WordLine[]) => {
    setDesigns((prev) => prev.map((d) => {
      if (d.id !== editingWordDesignId) return d
      const cleaned = sanitizeMenuHtml(wordLinesToHtml(newLines))
      const templateUrl = getTemplateUrl(selectedCat, selectedFile)
      const palette = wordPalette ?? { heading: '#5A0016', item: '#8C6A1F', desc: '#4B5563' }
      return { ...d, pages: [{ ...d.pages[0], html: buildWordPageHtml(cleaned, templateUrl, palette) }], raw: cleaned, wordLines: newLines }
    }))
    setEditingWordDesignId(null)
    toast.success('Design updated. Click "Save Version" to keep it.')
  }

  const handleDownloadWord = async (design: MenuDesign) => {
    if (!selectedCat || !selectedFile) {
      toast.error('Select a template first')
      return
    }
    setDownloadingWord(true)
    try {
      await downloadWordMenu({
        lines: design.wordLines ?? extractWordLinesFromHtml(design.raw),
        template_category: selectedCat,
        template_file: selectedFile,
        colors: wordPalette ?? { heading: '#5A0016', item: '#8C6A1F', desc: '#4B5563' },
      })
      toast.success('Word file downloaded')
    } catch (err) {
      toast.error(getErrorMessage(err, 'Word export failed'))
    } finally {
      setDownloadingWord(false)
    }
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
                      <img src={getTemplateThumbUrl(cat.name, f)} alt={f} loading="lazy" decoding="async" className="h-20 w-full object-cover" />
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
        <div className="mb-2 flex items-center justify-between">
          <label className="block text-[11px] font-bold uppercase text-gray-500">Labeled Menu List</label>
          <label className="flex cursor-pointer items-center gap-1.5 rounded-lg border border-gray-200 px-3 py-1.5 text-[11px] font-medium text-gray-600 transition-colors hover:bg-gray-50">
            <Upload size={12} /> {uploadingWord ? 'Importing…' : 'Upload Word File (.doc / .docx)'}
            <input type="file" className="hidden" accept=".doc,.docx" disabled={uploadingWord}
              onChange={(e) => { handleWordUpload(e.target.files?.[0]); e.target.value = '' }} />
          </label>
        </div>
        <textarea value={designMenuText} onChange={(e) => setDesignMenuText(e.target.value)}
          placeholder={'STARTERS:\nPaneer Tikka\nHara Bhara Kebab\n\nMAIN COURSE:\nDal Makhani\nShahi Paneer\n\nDESSERTS:\nGulab Jamun\nRasmalai'}
          className="h-40 w-full rounded-lg border border-gray-200 p-3 font-mono text-sm focus:outline-none focus:ring-2 focus:ring-gold/30" />
        <button onClick={handleDesignMenu} disabled={designing}
          className="mt-3 flex h-11 w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-gold to-amber-600 text-sm font-bold text-white shadow-lg transition-colors hover:from-gold hover:to-amber-700 disabled:opacity-50">
          {designing ? <><Loader2 size={16} className="animate-spin" /> Designing 3 Options...</> : <><Palette size={16} /> Design Menu Picture</>}
        </button>

        {/* Save Version + History */}
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <button
            onClick={() => {
              setSavingVersion(true)
              saveVersionMutation.mutate(undefined, { onSettled: () => setSavingVersion(false) })
            }}
            disabled={designs.length === 0 || savingVersion || saveVersionMutation.isPending}
            className="flex h-9 items-center gap-2 rounded-lg bg-maroon px-4 text-xs font-bold text-white transition-colors hover:bg-maroon-dark disabled:cursor-not-allowed disabled:opacity-50"
          >
            {savingVersion || saveVersionMutation.isPending ? <Loader2 size={13} className="animate-spin" /> : <Save size={13} />} Save Version
          </button>
          <button
            onClick={() => setShowHistory((v) => !v)}
            className="flex h-9 items-center gap-2 rounded-lg border border-gray-200 px-4 text-xs font-medium text-gray-600 transition-colors hover:bg-gray-50"
          >
            <History size={13} /> Menu History {menuVersions.length > 0 && <span className="rounded-full bg-gray-100 px-1.5 text-[10px] font-bold text-gray-500">{menuVersions.length}</span>}
            {showHistory ? <ChevronUp size={13} /> : <ChevronDown size={13} />}
          </button>
        </div>

        {/* Menu History Panel */}
        {showHistory && (
          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
            className="mt-3 rounded-lg border border-gray-100 bg-gray-50 p-3">
            {versionsLoading ? (
              <div className="flex justify-center py-6">
                <Loader2 size={18} className="animate-spin text-gray-400" />
              </div>
            ) : menuVersions.length === 0 ? (
              <p className="py-4 text-center text-xs text-gray-400">No saved versions yet. Design a menu and click "Save Version".</p>
            ) : (
              <div className="space-y-2">
                {menuVersions.map((v) => (
                  <div key={v.id} className="flex items-center justify-between gap-3 rounded-lg border border-gray-200 bg-white p-3">
                    <div className="min-w-0">
                      <p className="text-xs font-bold text-gray-900">Version {v.version}
                        <span className="ml-2 text-[10px] font-medium text-gray-400">
                          {v.created_at ? new Date(v.created_at).toLocaleString('en-IN', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : ''}
                        </span>
                      </p>
                      <p className="mt-0.5 truncate text-[11px] text-gray-500">
                        {v.designs?.length ?? 0} design{v.designs?.length !== 1 ? 's' : ''}
                        {v.template_category && ` · ${v.template_category}${v.template_file ? ` / ${v.template_file}` : ''}`}
                      </p>
                    </div>
                    <div className="flex shrink-0 gap-1.5">
                      <button onClick={() => setViewingVersion(v.version)}
                        className="flex h-7 items-center gap-1 rounded-lg border border-gray-200 px-2 text-[10px] font-medium text-gray-600 hover:bg-gray-50">
                        <Eye size={11} /> View
                      </button>
                      <button onClick={() => handleLoadVersion(v)}
                        className="flex h-7 items-center gap-1 rounded-lg bg-maroon px-2 text-[10px] font-bold text-white hover:bg-maroon-dark">
                        <RotateCcw size={11} /> Load & Edit
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </motion.div>
        )}
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
                    <div key={pi} className="mb-3 overflow-hidden rounded-lg shadow-sm last:mb-0">
                      <PagePreview html={page.html} scopeId={`${design.id}-p${pi}`} />
                    </div>
                  ))}
                </div>
                <div className="p-3">
                  {design.id.startsWith('word_') ? (
                    <button onClick={() => setEditingWordDesignId(design.id)}
                      className="mb-2 flex h-8 w-full items-center justify-center gap-1.5 rounded-lg border border-gold/40 bg-gold/10 text-[11px] font-medium text-amber-700 transition-colors hover:bg-gold/20">
                      <Pencil size={12} /> Edit Items
                    </button>
                  ) : (
                    <button onClick={() => handleOpenEdit(design)}
                      className="mb-2 flex h-8 w-full items-center justify-center gap-1.5 rounded-lg border border-gold/40 bg-gold/10 text-[11px] font-medium text-amber-700 transition-colors hover:bg-gold/20">
                      <Pencil size={12} /> Edit Items
                    </button>
                  )}
                  {design.id.startsWith('word_') ? (
                    <div className="grid grid-cols-2 gap-2">
                      <button onClick={() => handleDownloadDesignPdf(design)} disabled={downloadingPdf === design.id}
                        className="flex h-8 items-center justify-center gap-1.5 rounded-lg bg-maroon text-[11px] font-medium text-white transition-colors hover:bg-maroon-dark disabled:opacity-50">
                        {downloadingPdf === design.id ? <Loader2 size={12} className="animate-spin" /> : <FileDown size={12} />} PDF
                      </button>
                      <button onClick={() => handleDownloadWord(design)} disabled={downloadingWord}
                        className="flex h-8 items-center justify-center gap-1.5 rounded-lg border border-maroon text-[11px] font-medium text-maroon transition-colors hover:bg-maroon/5 disabled:opacity-50">
                        {downloadingWord ? <Loader2 size={12} className="animate-spin" /> : <FileDown size={12} />} Word
                      </button>
                    </div>
                  ) : (
                    <div className="grid grid-cols-3 gap-2">
                      <button onClick={() => handleDownloadDesignPdf(design)} disabled={downloadingPdf === design.id}
                        className="flex h-8 items-center justify-center gap-1.5 rounded-lg bg-maroon text-[11px] font-medium text-white transition-colors hover:bg-maroon-dark disabled:opacity-50">
                        {downloadingPdf === design.id ? <Loader2 size={12} className="animate-spin" /> : <FileDown size={12} />} PDF
                      </button>
                      <button onClick={() => handleDownloadWord(design)} disabled={downloadingWord}
                        className="flex h-8 items-center justify-center gap-1.5 rounded-lg border border-maroon text-[11px] font-medium text-maroon transition-colors hover:bg-maroon/5 disabled:opacity-50">
                        {downloadingWord ? <Loader2 size={12} className="animate-spin" /> : <FileDown size={12} />} Word
                      </button>
                      <button onClick={() => handleRegenerateDesign(design)} disabled={regeneratingIdx !== null}
                        className="flex h-8 items-center justify-center gap-1.5 rounded-lg border border-gray-200 text-[11px] font-medium text-gray-600 transition-colors hover:bg-gray-50 disabled:opacity-50">
                        {regeneratingIdx === design.id ? <Loader2 size={12} className="animate-spin" /> : <RotateCcw size={12} />} Re-gen
                      </button>
                    </div>
                  )}
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      )}

      {/* Version Viewer Modal */}
      {viewingVersion !== null && (() => {
        const v = menuVersions.find((x) => x.version === viewingVersion)
        if (!v) return null
        return (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}
            className="fixed inset-0 z-50 flex items-start justify-center bg-black/50 p-4 backdrop-blur-sm"
            onClick={() => setViewingVersion(null)}>
            <motion.div initial={{ opacity: 0, scale: 0.97 }} animate={{ opacity: 1, scale: 1 }}
              className="mt-8 w-full max-w-4xl overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-2xl"
              onClick={(e) => e.stopPropagation()}>
              <div className="flex items-center justify-between border-b border-gray-100 px-5 py-4">
                <h3 className="text-sm font-bold text-gray-900">Version {v.version}</h3>
                <button onClick={() => setViewingVersion(null)}
                  className="rounded-lg p-1.5 text-gray-400 hover:bg-gray-100 hover:text-gray-600">
                  <X size={16} />
                </button>
              </div>
              <div className="max-h-[80vh] overflow-y-auto bg-gray-50 p-5">
                {v.designs && v.designs.length > 0 ? (
                  <div className="grid gap-4 lg:grid-cols-3">
                    {v.designs.map((d, di) => (
                      <div key={di} className="overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm">
                        <div className="border-b border-gray-100 px-4 py-3">
                          <h4 className="text-sm font-bold text-gray-900">{d.name}</h4>
                          <p className="text-[10px] text-gray-400">{d.pages?.length ?? 0} pages · A4</p>
                        </div>
                        <div className="max-h-96 overflow-y-auto bg-gray-50 p-3">
                          {(d.pages ?? []).map((page, pi) => (
                            <div key={pi} className="mb-3 overflow-hidden rounded-lg shadow-sm last:mb-0">
                              <PagePreview html={page.html} scopeId={`ver${v.version}-d${di}-p${pi}`} />
                            </div>
                          ))}
                        </div>
                        <div className="flex gap-2 border-t border-gray-100 p-3">
                          <button onClick={() => { setDesigns(v.designs ?? []); setViewingVersion(null); if (d.id.startsWith('word_')) setEditingWordDesignId(d.id); else handleOpenEdit(d) }}
                            className="flex h-8 flex-1 items-center justify-center gap-1.5 rounded-lg border border-gold/40 bg-gold/10 text-[11px] font-medium text-amber-700 transition-colors hover:bg-gold/20">
                            <Pencil size={12} /> Edit
                          </button>
                          <button onClick={() => d.id.startsWith('word_') ? handleDownloadWord(d) : handleDownloadDesignPdf(d)} disabled={downloadingWord || downloadingPdf === d.id}
                            className="flex h-8 flex-1 items-center justify-center gap-1.5 rounded-lg bg-maroon text-[11px] font-medium text-white transition-colors hover:bg-maroon-dark disabled:opacity-50">
                            {downloadingWord || downloadingPdf === d.id ? <Loader2 size={12} className="animate-spin" /> : <FileDown size={12} />} {d.id.startsWith('word_') ? 'Word' : 'PDF'}
                          </button>
                          {!d.id.startsWith('word_') && (
                            <button onClick={() => { setDesigns(v.designs ?? []); setViewingVersion(null); handleRegenerateDesign(d) }} disabled={regeneratingIdx !== null}
                              className="flex h-8 flex-1 items-center justify-center gap-1.5 rounded-lg border border-gray-200 text-[11px] font-medium text-gray-600 transition-colors hover:bg-gray-50 disabled:opacity-50">
                              {regeneratingIdx === d.id ? <Loader2 size={12} className="animate-spin" /> : <RotateCcw size={12} />} Regenerate
                            </button>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="py-8 text-center text-sm text-gray-400">This version has no designs saved.</p>
                )}
              </div>
            </motion.div>
          </motion.div>
        )
      })()}

      {/* Edit Design Modal */}
      {editingDesignId !== null && (() => {
        const design = designs.find((d) => d.id === editingDesignId)
        if (!design) return null
        return (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}
            className="fixed inset-0 z-50 flex items-start justify-center bg-black/50 p-4 backdrop-blur-sm"
            onClick={() => { setEditingDesignId(null); setEditDraft([]) }}>
            <motion.div initial={{ opacity: 0, scale: 0.97 }} animate={{ opacity: 1, scale: 1 }}
              className="mt-8 w-full max-w-3xl overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-2xl"
              onClick={(e) => e.stopPropagation()}>
              <div className="flex items-center justify-between border-b border-gray-100 px-5 py-4">
                <div>
                  <h3 className="text-sm font-bold text-gray-900">Edit Menu Items</h3>
                  <p className="text-[11px] text-gray-400">{design.name} — update headings and items, then save. Click "Save Version" afterwards to keep the change.</p>
                </div>
                <button onClick={() => { setEditingDesignId(null); setEditDraft([]) }}
                  className="rounded-lg p-1.5 text-gray-400 hover:bg-gray-100 hover:text-gray-600">
                  <X size={16} />
                </button>
              </div>
              <div className="max-h-[70vh] space-y-4 overflow-y-auto bg-gray-50 p-5">
                {/* Fonts */}
                <div className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
                  <label className="mb-2 block text-[10px] font-bold uppercase tracking-wider text-gray-400">Design Fonts</label>
                  <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                    {([
                      ['Title font', 'title'],
                      ['Heading font', 'heading'],
                      ['Item font', 'item'],
                      ['Description font', 'description'],
                    ] as const).map(([label, key]) => (
                      <div key={key}>
                        <label className="mb-1 block text-[10px] font-medium text-gray-500">{label}</label>
                        <div className="flex items-center gap-2">
                          <select
                            value={editFonts[key] || ''}
                            onChange={(e) => setEditFonts((f) => ({ ...f, [key]: e.target.value }))}
                            className="w-full rounded-lg border border-gray-200 px-2 py-1.5 text-xs text-gray-700 focus:outline-none focus:ring-2 focus:ring-gold/30"
                            style={{ fontFamily: editFonts[key] || undefined }}
                          >
                            {FONT_OPTIONS.map((f) => (
                              <option key={f.value} value={f.value} style={{ fontFamily: f.value }}>{f.label}</option>
                            ))}
                          </select>
                          <label className="relative h-7 w-8 shrink-0 cursor-pointer overflow-hidden rounded-md border border-gray-200">
                            <input
                              type="color"
                              value={editColors[key] || '#000000'}
                              onChange={(e) => setEditColors((c) => ({ ...c, [key]: e.target.value }))}
                              className="absolute -inset-1 h-10 w-12 cursor-pointer border-0 p-0"
                              title={`${label} colour`}
                            />
                            {!editColors[key] && (
                              <span className="pointer-events-none absolute inset-0 flex items-center justify-center text-[8px] font-bold text-gray-300">?</span>
                            )}
                          </label>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {editDraft.map((page) => (
                  <div key={page.pageIndex} className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
                    {page.headings.map((heading, hi) => (
                      <div key={heading.key} className="mb-3 last:mb-0">
                        <label className="mb-1 block text-[10px] font-bold uppercase tracking-wider text-gray-400">
                          {hi === 0 ? 'Title' : hi === page.headings.length - 1 ? 'Section Heading' : 'Subtitle'}
                        </label>
                        <input value={heading.text} onChange={(e) => handleEditHeading(page.pageIndex, heading.key, e.target.value)}
                          className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm font-semibold text-gray-900 focus:outline-none focus:ring-2 focus:ring-gold/30" />
                      </div>
                    ))}
                    <label className="mb-1 mt-4 block text-[10px] font-bold uppercase tracking-wider text-gray-400">Dishes</label>
                    <div className="space-y-2">
                      {page.items.map((item) => (
                        <div key={item.key} className="flex items-center gap-2">
                          <input value={item.text} onChange={(e) => handleEditItem(page.pageIndex, item.key, e.target.value)}
                            placeholder="Dish name"
                            className="w-1/2 rounded-lg border border-gray-200 px-3 py-1.5 text-sm text-gray-700 focus:outline-none focus:ring-2 focus:ring-gold/30" />
                          <input value={item.description ?? ''} onChange={(e) => handleEditDescription(page.pageIndex, item.key, e.target.value)}
                            placeholder="Description (optional)"
                            className="w-1/2 rounded-lg border border-gray-200 px-3 py-1.5 text-sm text-gray-500 focus:outline-none focus:ring-2 focus:ring-gold/30" />
                          <button onClick={() => handleRemoveItem(page.pageIndex, item.key)}
                            className="shrink-0 rounded-lg border border-red-100 p-2 text-red-400 transition-colors hover:bg-red-50 hover:text-red-600">
                            <Trash2 size={13} />
                          </button>
                        </div>
                      ))}
                    </div>
                    <button onClick={() => handleAddItem(page.pageIndex)}
                      className="mt-3 flex h-8 items-center gap-1.5 rounded-lg border border-dashed border-gray-300 px-3 text-[11px] font-medium text-gray-500 transition-colors hover:border-gold hover:text-amber-700">
                      <Plus size={12} /> Add dish
                    </button>
                  </div>
                ))}
              </div>
              <div className="flex items-center justify-end gap-2 border-t border-gray-100 px-5 py-4">
                <button onClick={() => { setEditingDesignId(null); setEditDraft([]) }}
                  className="flex h-9 items-center rounded-lg border border-gray-200 px-4 text-xs font-medium text-gray-600 transition-colors hover:bg-gray-50">
                  Cancel
                </button>
                <button onClick={handleSaveEdit}
                  className="flex h-9 items-center gap-2 rounded-lg bg-maroon px-4 text-xs font-bold text-white transition-colors hover:bg-maroon-dark">
                  <Save size={13} /> Save Changes
                </button>
              </div>
            </motion.div>
          </motion.div>
        )
      })()}

      {/* Word Import Edit Modal */}
      {editingWordDesignId !== null && (() => {
        const design = designs.find((d) => d.id === editingWordDesignId)
        if (!design) return null
        return (
          <WordMenuEditor
            lines={design.wordLines ?? extractWordLinesFromHtml(design.raw)}
            onClose={() => setEditingWordDesignId(null)}
            onSave={handleSaveWordEdit}
          />
        )
      })()}
    </div>
  )
}
