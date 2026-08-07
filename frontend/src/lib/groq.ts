const GROQ_API_KEY = import.meta.env.VITE_GROQ_API_KEY as string
const GROQ_URL = 'https://api.groq.com/openai/v1/chat/completions'
const GROQ_MODEL = 'llama-3.3-70b-versatile'

export interface GroqResponse {
  text: string
  error?: string
}

async function callGroq(prompt: string): Promise<GroqResponse> {
  try {
    const res = await fetch(GROQ_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${GROQ_API_KEY}`,
      },
      body: JSON.stringify({
        model: GROQ_MODEL,
        messages: [{ role: 'user', content: prompt }],
        temperature: 0.7,
        max_tokens: 2048,
      }),
    })

    if (!res.ok) {
      const err = await res.json().catch(() => ({}))
      return { text: '', error: err?.error?.message ?? `API error ${res.status}` }
    }

    const data = await res.json()
    const text = data?.choices?.[0]?.message?.content ?? ''
    return { text }
  } catch (e: any) {
    return { text: '', error: e?.message ?? 'Network error' }
  }
}

// ── AI Menu Generation ──
export async function generateMenu(params: {
  season: string
  budget: string
  guests: string
  eventType: string
  customPrompt?: string
}): Promise<GroqResponse> {
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

  return callGroq(prompt)
}

// ── AI Cost Estimation ──
export async function estimateCost(params: {
  menu: string
  guests: string
  eventType: string
}): Promise<GroqResponse> {
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

  return callGroq(prompt)
}

// ── AI Reports ──
export async function generateReport(params: {
  type: string
  data: string
  period: string
}): Promise<GroqResponse> {
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

  return callGroq(prompt)
}

// ── AI Insights ──
export async function generateInsights(params: {
  context: string
  data: string
}): Promise<GroqResponse> {
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

  return callGroq(prompt)
}

// ── AI Menu Designer ──
export async function generateMenuDesign(params: {
  menuText: string
  eventType: string
  clientName: string
  templateInfo: string
}): Promise<GroqResponse> {
  const prompt = `You are an expert menu card designer for Shagun Caterers (pure veg only).
Design a beautiful printable menu card using the user's menu list and section labels.

Client: ${params.clientName}
Event Type: ${params.eventType}
Template background: ${params.templateInfo || 'No template selected — use a clean white background'}

USER'S MENU LIST (section labels are headings):
${params.menuText}

INSTRUCTIONS:
- Return exactly 3 DIFFERENT design options separated by "---DESIGN---".
- Inside each design option, separate pages with "---PAGE---".
- Each page is a COMPLETE HTML fragment: a <style> block (scoped inline styles) followed by <body> markup. Do NOT include <html>, <head>, doctype, <script>, external images, or absolute URLs.
- Each labeled section of the user's menu becomes its OWN page. Example: STARTERS page, MAIN COURSE page, DESSERTS page.
- Use the user's exact section label text as the page heading.
- The template background is set via CSS on a wrapper div, e.g. <div style="background-image:url('TEMPLATE_URL');background-size:100% 100%;background-position:center;background-repeat:no-repeat;min-height:100vh"> ... </div>. Replace TEMPLATE_URL literally with the given template URL string.
- Give each option a distinct theme appropriate to the event (wedding: gold/maroon elegant serif; engagement: rose/gold; corporate: navy/steel clean sans-serif). Vary fonts, colors, heading treatments, and item bullet styles between the 3 options.
- Use <h1> for the design/menu title, the section label as <h2>, and a <ul>/<li> per dish.
- Keep all CSS inline in a <style> tag that only targets the page. Use CSS classes, not element selectors that could leak.
- Content must fit A4 portrait (compact spacing, reasonable font sizes).`
  return callGroq(prompt)
}
