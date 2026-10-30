import { cn } from '@/lib/utils'

type Kind = { label: string; color: string }

const KINDS: Record<string, Kind> = {
  pdf: { label: 'PDF', color: '#e5252a' },
  doc: { label: 'DOC', color: '#2b579a' },
  xls: { label: 'XLS', color: '#217346' },
  ppt: { label: 'PPT', color: '#d24726' },
  img: { label: 'IMG', color: '#8b5cf6' },
  zip: { label: 'ZIP', color: '#d4a017' },
  txt: { label: 'TXT', color: '#64748b' },
  csv: { label: 'CSV', color: '#0f9d58' },
  code: { label: '</>', color: '#0ea5e9' },
  vid: { label: 'VID', color: '#db2777' },
  file: { label: 'FILE', color: '#94a3b8' },
}

const BY_EXT: Record<string, keyof typeof KINDS> = {
  pdf: 'pdf',
  doc: 'doc', docx: 'doc', odt: 'doc', rtf: 'doc',
  xls: 'xls', xlsx: 'xls', ods: 'xls',
  csv: 'csv',
  ppt: 'ppt', pptx: 'ppt', odp: 'ppt',
  png: 'img', jpg: 'img', jpeg: 'img', gif: 'img', webp: 'img', svg: 'img', bmp: 'img',
  zip: 'zip', rar: 'zip', '7z': 'zip', tar: 'zip', gz: 'zip',
  txt: 'txt', md: 'txt', log: 'txt',
  sql: 'code', json: 'code', xml: 'code', html: 'code', ts: 'code', js: 'code', py: 'code', java: 'code', cs: 'code',
  mp4: 'vid', mov: 'vid', avi: 'vid', mkv: 'vid',
}

export function fileKind(name: string): Kind {
  const ext = name.includes('.') ? name.split('.').pop()!.toLowerCase() : ''
  return KINDS[BY_EXT[ext] ?? 'file']!
}

/** "Logo" de archivo: hoja con esquina doblada y etiqueta de color según el tipo. */
export function FileIcon({ name, className }: { name: string; className?: string }) {
  const { label, color } = fileKind(name)
  return (
    <svg viewBox="0 0 32 40" className={cn('h-7 w-[22px] shrink-0 drop-shadow-sm', className)} aria-hidden>
      <path d="M3 1h18l8 8v28a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V3a2 2 0 0 1 2-2z" fill="#fff" stroke="#d6d3e0" strokeWidth="1.2" />
      <path d="M21 1v6a2 2 0 0 0 2 2h6" fill="#eceaf3" stroke="#d6d3e0" strokeWidth="1.2" />
      <rect x="0" y="20" width={label.length > 3 ? 30 : 26} height="12" rx="2" fill={color} />
      <text
        x={label.length > 3 ? 15 : 13}
        y="29.2"
        textAnchor="middle"
        fontSize={label.length > 3 ? 7.2 : 8.4}
        fontWeight="700"
        fontFamily="system-ui, sans-serif"
        fill="#fff"
      >
        {label}
      </text>
    </svg>
  )
}
