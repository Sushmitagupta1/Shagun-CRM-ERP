import { MENU_PALETTES } from './menuDesign'

const GEMINI_API_KEY = import.meta.env.VITE_GEMINI_API_KEY as string
const GEMINI_URL = 'https://generativelanguage.googleapis.com/v1beta/openai/chat/completions'
// flash-lite has no hidden "thinking" tokens, so long HTML outputs are not
// truncated by the token budget (gemini-3.5-flash truncates on this endpoint).
const GEMINI_MODEL = 'gemini-3.1-flash-lite'

export interface AIResponse {
  text: string
  error?: string
}

// Small delay helper for rate-limit retries.
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms))

// Retries up to 3 times when Gemini rate-limits us (429). Waits for the
// retry-after window so the request eventually goes through.
async function callGeminiWithRetry(prompt: string, imageDataUrl: string | null, maxTokens: number): Promise<AIResponse> {
  for (let attempt = 0; attempt < 3; attempt++) {
    const res = await callGeminiRaw(prompt, imageDataUrl, maxTokens)
    if (res.retryAfterMs) {
      if (attempt < 2) {
        await sleep(res.retryAfterMs + 1000)
        continue
      }
      return { text: '', error: res.error || 'Rate limit exceeded. Try again in a minute.' }
    }
    return { text: res.text, error: res.error }
  }
  return { text: '', error: 'Rate limit exceeded. Try again in a minute.' }
}

interface RawResult {
  text: string
  error?: string
  retryAfterMs?: number
}

// OpenAI-compatible endpoint: accepts both plain text prompts and vision
// prompts (template image sent as a data URL in image_url).
async function callGeminiRaw(prompt: string, imageDataUrl: string | null, maxTokens: number): Promise<RawResult> {
  let content: any = prompt
  if (imageDataUrl) {
    content = [
      { type: 'text', text: prompt },
      { type: 'image_url', image_url: { url: imageDataUrl } },
    ]
  }
  try {
    const res = await fetch(GEMINI_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${GEMINI_API_KEY}`,
      },
      body: JSON.stringify({
        model: GEMINI_MODEL,
        messages: [{ role: 'user', content }],
        temperature: 0.7,
        max_tokens: maxTokens,
      }),
    })

    if (!res.ok) {
      const err = await res.json().catch(() => ({}))
      const msg = err?.error?.message ?? `API error ${res.status}`
      if (res.status === 429 || msg.includes('rate limit') || msg.toLowerCase().includes('resource exhausted')) {
        const retryMs = extractRetryMs(msg, res)
        return { text: '', error: msg, retryAfterMs: retryMs }
      }
      return { text: '', error: msg }
    }

    const data = await res.json()
    return { text: data?.choices?.[0]?.message?.content ?? '' }
  } catch (e: any) {
    return { text: '', error: e?.message ?? 'Network error' }
  }
}

function extractRetryMs(msg: string, res: Response): number {
  const m = msg.match(/try again in ([\d.]+)s/i)
  if (m) return Math.ceil(parseFloat(m[1]) * 1000)
  const header = res.headers.get('retry-after')
  if (header) {
    const secs = parseFloat(header)
    if (!isNaN(secs)) return Math.ceil(secs * 1000)
  }
  return 20000
}

// Text-only call: routes through retry handling.
async function callGemini(prompt: string, maxTokens = 4096): Promise<AIResponse> {
  return callGeminiWithRetry(prompt, null, maxTokens)
}

// Vision-capable call: sends the template image along with the prompt so the
// model can see the actual template and design accordingly.
async function callGeminiVision(prompt: string, imageDataUrl: string, maxTokens = 4500): Promise<AIResponse> {
  return callGeminiWithRetry(prompt, imageDataUrl, maxTokens)
}

// Fetches a template image (same-origin) and returns a resized JPEG data URL
// suitable for sending to the vision model. Returns null if it can't load.
// Kept small (<= 512px, quality 0.7) to keep prompt tokens low.
export async function loadImageAsDataUrl(url: string, maxDim = 384): Promise<string | null> {
  try {
    const blob = await fetch(url).then((r) => (r.ok ? r.blob() : null))
    if (!blob) return null
    const objectUrl = URL.createObjectURL(blob)
    const img = new Image()
    img.src = objectUrl
    await img.decode()
    URL.revokeObjectURL(objectUrl)
    const scale = Math.min(1, maxDim / Math.max(img.naturalWidth, img.naturalHeight))
    const w = Math.max(1, Math.round(img.naturalWidth * scale))
    const h = Math.max(1, Math.round(img.naturalHeight * scale))
    const canvas = document.createElement('canvas')
    canvas.width = w
    canvas.height = h
    const ctx = canvas.getContext('2d')
    if (!ctx) return null
    ctx.drawImage(img, 0, 0, w, h)
    return canvas.toDataURL('image/jpeg', 0.7)
  } catch {
    return null
  }
}

// ── AI Menu Generation ──
export async function generateMenu(params: {
  season: string
  budget: string
  guests: string
  eventType: string
  customPrompt?: string
}): Promise<AIResponse> {
  const prompt = params.customPrompt || `You are a senior catering chef for Shagun Caterers (pure veg only). Generate a detailed menu for:
Event Type: ${params.eventType || 'General'}
Season: ${params.season || 'All'}
Budget: ${params.budget || 'Flexible'}
Guests: ${params.guests || 'Not specified'}

Provide:
1. Starters (4-6 items)
2. Main Course (6-8 items)
3. Breads & Rice (3-4 items)
4. Desserts (3-4 items)
5. Beverages (2-3 items)

For each item give: name, brief description, estimated cost per plate contribution.
End with total estimated cost per plate and tips for customization.
Format with bold headings and bullet points.`

  return callGemini(prompt)
}

// ── AI Cost Estimation ──
export async function estimateCost(params: {
  menu: string
  guests: string
  eventType: string
}): Promise<AIResponse> {
  const prompt = `You are a catering cost analyst for Shagun Caterers (pure veg). Estimate costs for:
Menu: ${params.menu || 'Standard pure veg menu'}
Guests: ${params.guests || '100'}
Event Type: ${params.eventType || 'Wedding'}

Provide a detailed breakdown:
1. Raw material cost per plate
2. Labor cost per plate
3. Equipment & logistics per plate
4. Overhead & margin
5. Total cost per plate
6. Total project cost
7. Suggested pricing (with margin tiers: Standard, Premium, Luxury)
8. Cost-saving tips

Format as a professional cost sheet with clear sections.`

  return callGemini(prompt)
}

// ── AI Reports ──
export async function generateReport(params: {
  type: string
  data: string
  period: string
}): Promise<AIResponse> {
  const prompt = `You are a business analyst for Shagun Caterers ERP. Generate a ${params.type} report for ${params.period || 'this month'}.

Current data: ${params.data || 'No specific data provided'}

Provide:
1. Executive Summary
2. Key Metrics & KPIs
3. Trends Analysis
4. Comparison with previous period
5. Recommendations
6. Action Items

Format as a professional business report with clear sections and insights.`

  return callGemini(prompt)
}

// ── AI Insights ──
export async function generateInsights(params: {
  context: string
  data: string
}): Promise<AIResponse> {
  const prompt = `You are a business intelligence analyst for Shagun Caterers ERP. Analyze the following and provide actionable insights:

Context: ${params.context}
Data: ${params.data || 'Provide general business insights based on catering industry best practices'}

Provide:
1. Key Observations (3-5 bullet points)
2. Patterns & Trends
3. Risk Areas
4. Growth Opportunities
5. Recommended Actions (prioritized)
6. Quick Wins

Be specific, data-driven, and actionable. Format with clear headings.`

  return callGemini(prompt)
}

// ── AI Menu Designer ──

// Gemini does not reliably output multiple designs in one response, so each
// option is generated in its own call (one distinct text palette per call) and
// the results are joined with the ---DESIGN--- separator the parser expects.
function cleanSingleDesign(text: string): string {
  let t = text.replace(/---DESIGN---/g, '').trim()
  const lines = t.split('\n')
  while (lines.length > 0 && !lines[0].trim().startsWith('<')) lines.shift()
  return lines.join('\n').trim()
}

export async function generateMenuDesign(params: {
  menuText: string
  eventType: string
  clientName: string
  templateInfo: string
  templateImage?: string | null
  count?: number
  previousDesign?: string | null
  paletteIndex?: number
}): Promise<AIResponse> {
  const designCount = params.count || 3
  const outputs: string[] = []
  for (let i = 0; i < designCount; i++) {
    const paletteIdx = params.paletteIndex ?? i
    const palette = MENU_PALETTES[paletteIdx % MENU_PALETTES.length]
    const themeNote = `- Apply THIS text palette (exact hex colours) for this option, option ${i + 1} of ${designCount}:
  HEADING colour ${palette.heading} — ALL CAPS, font-family ${palette.headingFont}.
  DISH NAME colour ${palette.item} — font-family ${palette.itemFont}.
  DESCRIPTION colour ${palette.desc} — font-family ${palette.descFont}.
  Use these exact colours and fonts; you may pick very close shades only if they clash badly with the template picture.`
    const prompt = buildMenuDesignPrompt(params, themeNote)
    const res = params.templateImage
      ? await callGeminiVision(prompt, params.templateImage, 40000)
      : await callGemini(prompt, 40000)
    if (res.error) return res
    const cleaned = cleanSingleDesign(res.text)
    if (!cleaned) return { text: '', error: 'AI returned an empty response. Try again.' }
    outputs.push(cleaned)
  }
  return { text: outputs.join('\n\n---DESIGN---\n\n') }
}

function buildMenuDesignPrompt(params: {
  menuText: string
  eventType: string
  clientName: string
  templateInfo: string
  templateImage?: string | null
  previousDesign?: string | null
}, themeNote: string): string {
  const templateImageNote = params.templateImage
    ? `\n- I am attaching the actual template picture. Study it carefully and match its border, frame, colours and style.
- The template picture already has its own border/frame decoration. Do NOT add any extra border or frame of your own — just place the text content in the CLEAR MIDDLE area inside the template's border, with comfortable padding so no text overlaps the border decoration.`
    : ''
  const regenerationNote = params.previousDesign
    ? `\n- This is a REGENERATION. Keep the same menu items and section labels, and KEEP the same text palette given below, but produce a clearly DIFFERENT layout: change the arrangement, ornament spacing and heading treatment. Do not just repeat the previous design.\nPREVIOUS VERSION (for reference only):\n${params.previousDesign.slice(0, 1500)}`
    : ''
  const backgroundGuidance = params.templateInfo
    ? `- Set the template background via CSS on the wrapper div, e.g. <div style="display:flex;align-items:center;justify-content:center;background-image:url('TEMPLATE_URL');background-size:cover;background-position:center;background-repeat:no-repeat;min-height:100vh;padding:40px"> ... </div>. Replace TEMPLATE_URL literally with the given template URL string. background-size:cover (NOT 100% 100%) so the picture fills the page without distortion. The wrapper MUST be display:flex with align-items:center and justify-content:center so the content sits in the MIDDLE of the border.`
    : `- Use a clean cream or white wrapper div (no background image), with the same flex centering so the content sits in the middle of the page.`
  return `You are an expert luxury menu card designer for Shagun Caterers (pure veg only).
Design a beautiful wedding-menu booklet using ONLY the user's menu list and section labels.

CONTENT RULE (very important):
- The design must contain ONLY text the user provided below. Do NOT invent the client's name, event name, dates, venues, phone numbers, or any other text.
- If the user's menu already starts with a heading/name/date line, that exact line may be used on the cover. Otherwise use a decorative ornament and the plain word "MENU".
- A "SPECIAL MENU FOR / AT / Decorator / Event Co-Ordinator / Colour Theme / Crockery & Cutlery / Type of Function / Type of Service / Office Address / Residence Address" block is a DETAILS page — render it exactly as given, leaving values blank when the user left them blank.

DESIGN STYLE:
- Warm cream / ivory page background (#F7EBDB to #FEF7EB). NO plain white, no dark page backgrounds.
- Use the option's text palette (given below) for all text colours and fonts. Only when a template picture is provided, keep its own border and do not add a frame of your own.
- Refined, symmetrical, spacious layout, everything horizontally centered.
Template background: ${params.templateInfo || 'No template selected — use the cream wedding style above'}

USER'S MENU LIST (section labels are headings):
${params.menuText}

${themeNote}

INSTRUCTIONS:
- Return exactly 1 design option. Do NOT output "---DESIGN---", "Design Option N:", "Page N:" or any other separator or label text — output only the page markup.
- Separate pages with "---PAGE---". The separator must appear BETWEEN complete pages, never inside a page's markup.
- Each page is a COMPLETE, SELF-CONTAINED HTML fragment: a <style> block (scoped inline styles) followed by the page markup wrapped in a single wrapper <div> that is opened AND closed on that same page. Do NOT share one wrapper <div> across pages. No <html>, <head>, doctype, <script>, external images, or absolute URLs.
- PAGE STRUCTURE, in this exact order:
  1. COVER page: large decorative title (use the user's top line if present, else "MENU"), small flourish ornament under it, nothing else.
  2. DETAILS page: title "PROPOSED MENU" (or "MENU") then "SPECIAL MENU FOR - PAX ON AT:" and the details list (Decorator, Event Co-Ordinator, Colour Theme, Crockery & Cutlery, Type of Function, Type of Service, Office Address, Residence Address) with the user's values after each colon. If the user's menu has no such block, skip this page.
  3. MENU pages: each labeled section of the user's menu becomes its OWN page (e.g. a "High Tea" page, a "Mehandi Dinner" page, a "Reception Dinner" page, then each station/section page). Use the user's exact section label as the <h2>.
- LIST EVERY DISH, DO NOT SKIP ANYTHING: every dish, drink and line the user wrote MUST appear. Never merge several dishes into one line, never summarise, never drop a dish or a subsection. If the menu is long, simply use more pages (---PAGE---) — but include absolutely everything.
- TYPOGRAPHY HIERARCHY (per menu page, mandatory):
  1. Section headings (<h2>): LARGE (16-20px), ALL CAPS, bold, in the HEADING colour and HEADING font of the option palette.
  2. Dish names (<strong class="dish-name"> inside each <li>): MEDIUM (13-15px), in the DISH NAME colour and DISH NAME font of the palette, sentence case (only the first word capitalised).
  3. Dish descriptions (<span class="dish-desc">, on their own line under the name): SMALL (10-11px), in the DESCRIPTION colour and DESCRIPTION font, sentence case.
- SPLITTING RULE: if a dish line contains a "-", "–", "—" or ":" separator, the part before it is the dish name and the part after it is the description. Lines without a separator are name-only (no description span).
- Do NOT capitalise dish names or descriptions — only headings are ALL CAPS.
- DISH LIST STRUCTURE (mandatory): <ul class="menu-dishes"> with one <li class="menu-dish"> per dish, containing <strong class="dish-name">NAME</strong> followed by <span class="dish-desc">DESCRIPTION</span> (omit the span when there is no description).
- Use <h1> for the page title (cover title, PROPOSED MENU), <h2> for section labels.
${backgroundGuidance}
- CENTER EACH PAGE: on the wrapper div use display:flex, align-items:center, justify-content:center, min-height:100vh, padding:40px. The inner card is centered (text-align:center) with padding; nothing touches the frame edges.
- SMALL COMPACT FONTS so the whole menu fits one A4 portrait sheet: cover title <h1> 26-34px, "PROPOSED MENU" <h1> 28-36px, section headings <h2> 16-20px, dish names 13-15px, descriptions 10-11px.
- Keep all CSS inline in a <style> tag that only targets the page. Use CSS classes, not element selectors that could leak.
- Content must fit A4 portrait. Each page must be a SINGLE A4 sheet — never let one section spill onto a second page, and never put two sections on one page.
${templateImageNote}
${regenerationNote}`
}

// ── AI Spelling Polish ──

// Fixes only spelling in a menu text; keeps categories, dish names' meaning,
// order and line structure unchanged.
export async function polishMenuText(text: string): Promise<AIResponse> {
  const prompt = `You are proofreading a catering menu. Fix ONLY spelling and obvious typos in the text below.
Rules:
- Do NOT change the categories, the dish names' meaning, the order of lines, or the number of lines.
- Do NOT add or remove lines, do NOT rephrase, do NOT restructure.
- Change only misspelled or mistyped words.
- Return ONLY the corrected text, keeping the exact same line breaks as the input. No extra commentary.

MENU TEXT:
${text}`
  return callGemini(prompt)
}
