import { useRef, useState } from 'react'
import { Upload, FileText } from 'lucide-react'

interface FileDropZoneProps {
  onFile: (file: File) => void
  selectedFile?: File | null
}

export default function FileDropZone({ onFile, selectedFile }: FileDropZoneProps) {
  const [dragging, setDragging] = useState(false)
  const [typeError, setTypeError] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  function accept(file: File) {
    if (!file.name.toLowerCase().endsWith('.csv')) {
      setTypeError(true)
      return
    }
    setTypeError(false)
    onFile(file)
  }

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault()
    setDragging(false)
    const file = e.dataTransfer.files[0]
    if (file) accept(file)
  }

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) accept(file)
    e.target.value = ''
  }

  return (
    <div
      onDragOver={(e) => { e.preventDefault(); setDragging(true) }}
      onDragLeave={() => setDragging(false)}
      onDrop={handleDrop}
      onClick={() => inputRef.current?.click()}
      className={`border-2 border-dashed rounded-xl p-12 text-center cursor-pointer transition-all select-none ${
        dragging
          ? 'border-blue-500 bg-blue-50 scale-[1.01]'
          : selectedFile
            ? 'border-green-400 bg-green-50'
            : 'border-gray-300 hover:border-gray-400 hover:bg-gray-50'
      }`}
    >
      <input
        ref={inputRef}
        type="file"
        accept=".csv"
        className="hidden"
        onChange={handleChange}
      />
      {typeError && (
        <p className="text-red-600 text-sm font-medium mb-2">
          Only CSV files are supported. In Numbers: File → Export To → CSV
        </p>
      )}
      {selectedFile ? (
        <>
          <FileText size={48} className="mx-auto mb-3 text-green-500" />
          <p className="text-green-700 font-medium">{selectedFile.name}</p>
          <p className="text-green-500 text-sm mt-1">
            {(selectedFile.size / 1024).toFixed(1)} KB — click to change file
          </p>
        </>
      ) : (
        <>
          <Upload size={48} className="mx-auto mb-3 text-gray-400" />
          <p className="text-gray-600 font-medium">
            Drop your LinkedIn Connections CSV here
          </p>
          <p className="text-gray-400 text-sm mt-1">or click to browse</p>
        </>
      )}
    </div>
  )
}
