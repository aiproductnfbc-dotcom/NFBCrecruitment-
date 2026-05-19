import { useCallback, useRef, useState } from 'react'
import { Upload, CheckCircle2, X, FileText, Loader2 } from 'lucide-react'
import { supabase } from '../../../lib/supabaseClient'

// TODO: implement periodic orphan cleanup if bucket fills up —
// abandoned uploads (user never submits) leave files in storage.

const ACCEPTED_TYPES = [
  'application/pdf',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
]
const ACCEPTED_EXTENSIONS = '.pdf,.doc,.docx'
const MAX_SIZE_BYTES = 5 * 1024 * 1024 // 5 MB
const BUCKET = 'job-board-cvs'

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  const kb = bytes / 1024
  if (kb < 1024) return `${kb.toFixed(0)} KB`
  return `${(kb / 1024).toFixed(1)} MB`
}

function getExtension(filename: string): string {
  const dot = filename.lastIndexOf('.')
  return dot >= 0 ? filename.slice(dot).toLowerCase() : '.pdf'
}

interface FileUploadFieldProps {
  value: string // cv_storage_path or ''
  onChange: (path: string) => void
  error?: string
}

type UploadState = 'empty' | 'selected' | 'uploading' | 'uploaded' | 'error'

export default function FileUploadField({ value, onChange, error: externalError }: FileUploadFieldProps) {
  const inputRef = useRef<HTMLInputElement>(null)
  const [state, setState] = useState<UploadState>(value ? 'uploaded' : 'empty')
  const [fileName, setFileName] = useState('')
  const [fileSize, setFileSize] = useState(0)
  const [dragging, setDragging] = useState(false)
  const [errorMsg, setErrorMsg] = useState('')

  const displayError = externalError || errorMsg

  const reset = useCallback(() => {
    setState('empty')
    setFileName('')
    setFileSize(0)
    setErrorMsg('')
    onChange('')
    if (inputRef.current) inputRef.current.value = ''
  }, [onChange])

  const uploadFile = useCallback(async (file: File) => {
    // Client-side validation
    if (!ACCEPTED_TYPES.includes(file.type)) {
      setErrorMsg('Please upload a PDF or Word document.')
      setState('error')
      return
    }
    if (file.size > MAX_SIZE_BYTES) {
      setErrorMsg(`File is too large (${formatSize(file.size)}). Maximum is 5 MB.`)
      setState('error')
      return
    }

    setFileName(file.name)
    setFileSize(file.size)
    setErrorMsg('')
    setState('uploading')

    const ext = getExtension(file.name)
    const path = `applications/${crypto.randomUUID()}${ext}`

    const { error } = await supabase.storage
      .from(BUCKET)
      .upload(path, file, { contentType: file.type, upsert: false })

    if (error) {
      const msg = error.message?.includes('mime')
        ? 'File type not allowed. Please upload a PDF or Word document.'
        : error.message?.includes('size')
          ? 'File is too large. Maximum is 5 MB.'
          : 'Upload failed. Please try again.'
      setErrorMsg(msg)
      setState('error')
      return
    }

    setState('uploaded')
    onChange(path)
  }, [onChange])

  const handleFiles = useCallback((files: FileList | null) => {
    if (!files?.length) return
    uploadFile(files[0])
  }, [uploadFile])

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    setDragging(false)
    handleFiles(e.dataTransfer.files)
  }, [handleFiles])

  const borderClass = displayError
    ? 'border-destructive/40'
    : dragging
      ? 'border-primary bg-primary/5'
      : state === 'uploaded'
        ? 'border-primary/30 bg-primary/5'
        : 'border-input hover:border-primary/40'

  return (
    <div>
      <div
        className={`relative rounded-xl border-2 border-dashed bg-card transition-colors ${borderClass} ${
          state === 'uploading' ? 'pointer-events-none' : 'cursor-pointer'
        }`}
        onDragOver={e => { e.preventDefault(); setDragging(true) }}
        onDragLeave={() => setDragging(false)}
        onDrop={handleDrop}
        onClick={() => state !== 'uploading' && inputRef.current?.click()}
      >
        <input
          ref={inputRef}
          type="file"
          accept={ACCEPTED_EXTENSIONS}
          className="sr-only"
          onChange={e => handleFiles(e.target.files)}
        />

        <div className="flex flex-col items-center gap-2 py-8 px-4 text-center">
          {state === 'empty' && (
            <>
              <Upload size={24} className="text-muted-foreground" />
              <p className="text-sm text-foreground font-medium">
                Drag your CV here, or click to browse
              </p>
              <p className="text-xs text-muted-foreground">PDF or Word, max 5 MB</p>
            </>
          )}

          {state === 'uploading' && (
            <>
              <Loader2 size={24} className="text-primary animate-spin" />
              <p className="text-sm text-foreground font-medium">{fileName}</p>
              <p className="text-xs text-muted-foreground">Uploading…</p>
            </>
          )}

          {state === 'uploaded' && (
            <>
              <CheckCircle2 size={24} className="text-primary" />
              <div className="flex items-center gap-2">
                <FileText size={14} className="text-muted-foreground" />
                <p className="text-sm text-foreground font-medium">{fileName}</p>
                <span className="text-xs text-muted-foreground">({formatSize(fileSize)})</span>
              </div>
              <div className="flex items-center gap-3 mt-1">
                <span className="inline-flex items-center gap-1 rounded-full bg-primary/10 text-primary px-2 py-0.5 text-xs font-medium">
                  Uploaded
                </span>
                <button
                  type="button"
                  onClick={e => { e.stopPropagation(); reset() }}
                  className="text-xs text-muted-foreground hover:text-foreground transition-colors underline"
                >
                  Replace
                </button>
              </div>
            </>
          )}

          {(state === 'selected' || state === 'error') && !fileName && (
            <>
              <Upload size={24} className="text-muted-foreground" />
              <p className="text-sm text-foreground font-medium">
                Drag your CV here, or click to browse
              </p>
              <p className="text-xs text-muted-foreground">PDF or Word, max 5 MB</p>
            </>
          )}

          {state === 'error' && fileName && (
            <>
              <FileText size={24} className="text-destructive" />
              <div className="flex items-center gap-2">
                <p className="text-sm text-foreground font-medium">{fileName}</p>
                <button
                  type="button"
                  onClick={e => { e.stopPropagation(); reset() }}
                  className="text-muted-foreground hover:text-foreground transition-colors"
                >
                  <X size={14} />
                </button>
              </div>
            </>
          )}
        </div>
      </div>

      {displayError && (
        <p className="mt-1.5 text-xs text-destructive">{displayError}</p>
      )}
    </div>
  )
}
