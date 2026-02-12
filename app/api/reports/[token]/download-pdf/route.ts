/**
 * Education Report PDF Download API
 *
 * Generates and returns the education report PDF for download.
 * Validates the report access token, fetches all necessary data,
 * and returns the PDF as a file attachment.
 */

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import type { EducationReportPDFData } from '@/lib/pdf/education-report-pdf'
import type { EducationSynthesisResult } from '@/lib/agents/education-synthesis-agent'
import { isValidTokenFormat } from '@/lib/utils/token-generator'

function getServiceClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ token: string }> }
): Promise<NextResponse> {
  try {
    const { token } = await params

    // Validate token format
    if (!token || !isValidTokenFormat(token)) {
      return NextResponse.json(
        { success: false, error: 'Invalid token' },
        { status: 400 }
      )
    }

    const supabase = getServiceClient()

    // Fetch report by access token
    const { data: report, error: reportError } = await supabase
      .from('education_reports')
      .select('id, synthesis_id, school_id, is_active, has_safeguarding_signals')
      .eq('access_token', token)
      .eq('is_active', true)
      .single()

    if (reportError || !report) {
      return NextResponse.json(
        { success: false, error: 'Report not found' },
        { status: 404 }
      )
    }

    // Fetch synthesis content
    const { data: synthesis, error: synthesisError } = await supabase
      .from('education_synthesis')
      .select('id, campaign_id, school_id, module, content, generated_at')
      .eq('id', report.synthesis_id)
      .single()

    if (synthesisError || !synthesis) {
      return NextResponse.json(
        { success: false, error: 'Synthesis data not found' },
        { status: 404 }
      )
    }

    // Fetch school info
    const { data: school } = await supabase
      .from('schools')
      .select('id, name, code, country, curriculum')
      .eq('id', report.school_id)
      .single()

    // Fetch campaign info
    const { data: campaign } = await supabase
      .from('campaigns')
      .select('id, name, description')
      .eq('id', synthesis.campaign_id)
      .single()

    // Format date
    const generatedDate = new Date(synthesis.generated_at).toLocaleDateString('en-GB', {
      day: 'numeric',
      month: 'long',
      year: 'numeric',
    })

    // Assemble PDF data
    const pdfData: EducationReportPDFData = {
      school: {
        id: school?.id || '',
        name: school?.name || 'Unknown School',
        code: school?.code || '',
        country: school?.country || null,
        curriculum: school?.curriculum || null,
      },
      campaign: {
        id: campaign?.id || '',
        name: campaign?.name || 'Assessment Report',
        description: campaign?.description || null,
      },
      module: synthesis.module,
      synthesis: synthesis.content as EducationSynthesisResult,
      hasSafeguardingSignals: report.has_safeguarding_signals || false,
      generatedAt: synthesis.generated_at,
      generatedDate,
    }

    // Generate PDF via Pages Router API
    const host = request.headers.get('host') || 'localhost:3000'
    const protocol = host.includes('localhost') ? 'http' : 'https'
    const pdfApiUrl = `${protocol}://${host}/api/generate-education-pdf`

    console.log('📄 Generating Education PDF for download:', school?.name, '-', synthesis.module)

    const pdfResponse = await fetch(pdfApiUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(pdfData),
      signal: AbortSignal.timeout(30000),
    })

    if (!pdfResponse.ok) {
      const errorText = await pdfResponse.text().catch(() => 'Failed to read response')
      console.error('❌ PDF API error:', errorText.substring(0, 200))
      return NextResponse.json(
        { success: false, error: 'Failed to generate PDF' },
        { status: 500 }
      )
    }

    const pdfResult = await pdfResponse.json()

    if (!pdfResult.success || !pdfResult.pdfBase64) {
      return NextResponse.json(
        { success: false, error: pdfResult.error || 'PDF generation failed' },
        { status: 500 }
      )
    }

    // Return PDF as downloadable file
    const pdfBuffer = Buffer.from(pdfResult.pdfBase64, 'base64')
    const schoolSlug = (school?.name || 'school').replace(/[^a-zA-Z0-9]/g, '-').toLowerCase()
    const moduleSlug = synthesis.module.replace(/_/g, '-')
    const filename = `${schoolSlug}-${moduleSlug}-report.pdf`

    console.log('✅ Education PDF generated for download, size:', pdfBuffer.length, 'bytes')

    return new NextResponse(pdfBuffer, {
      status: 200,
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="${filename}"`,
        'Content-Length': pdfBuffer.length.toString(),
      },
    })
  } catch (error) {
    console.error('Education PDF download error:', error)
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    )
  }
}
