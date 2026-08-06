import { X } from 'lucide-react'
import { useQuery } from '@tanstack/react-query'
import { previewInquiryFile } from '@/api/inquiries'
import type { InquiryFileType } from '@/api/inquiries'

export default function ExcelPreviewModal({
  inquiryId,
  fileType,
  fileName,
  onClose,
}: {
  inquiryId: string
  fileType: InquiryFileType
  fileName: string
  onClose: () => void
}) {
  const { data, isLoading, isError } = useQuery({
    queryKey: ['file-preview', inquiryId, fileType],
    queryFn: () => previewInquiryFile(inquiryId, fileType),
    enabled: Boolean(inquiryId && fileType),
  })

  const rows = data?.rows ?? []
  const header = rows[0] ?? []
  const body = rows.slice(1)

  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/40 p-4 backdrop-blur-sm" onClick={onClose}>
      <div
        className="flex max-h-[85vh] w-full max-w-3xl flex-col rounded-2xl border border-gray-200 bg-white shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-gray-100 px-6 py-4">
          <div>
            <h3 className="text-sm font-bold text-gray-900">Excel Preview</h3>
            <p className="max-w-[420px] truncate text-[11px] text-gray-500">{fileName}</p>
          </div>
          <button onClick={onClose} className="rounded-lg p-1.5 text-gray-400 hover:bg-gray-100 hover:text-gray-600">
            <X size={16} />
          </button>
        </div>
        <div className="flex-1 overflow-auto px-6 py-4">
          {isLoading ? (
            <p className="py-10 text-center text-xs text-gray-400">Loading preview...</p>
          ) : isError || rows.length === 0 ? (
            <p className="py-10 text-center text-xs text-gray-400">No preview available for this file.</p>
          ) : (
            <table className="w-full border-collapse">
              <thead>
                <tr>
                  {header.map((h, i) => (
                    <th key={i} className="border border-gray-200 bg-gray-50 px-3 py-2 text-left text-[11px] font-bold text-gray-600">
                      {String(h ?? '')}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {body.map((row, ri) => (
                  <tr key={ri}>
                    {row.map((cell, ci) => (
                      <td key={ci} className="border border-gray-100 px-3 py-1.5 text-[11px] text-gray-700">
                        {String(cell ?? '')}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  )
}
