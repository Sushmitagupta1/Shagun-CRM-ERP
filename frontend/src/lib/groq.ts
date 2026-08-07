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
