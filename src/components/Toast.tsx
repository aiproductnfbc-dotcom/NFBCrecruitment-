import { createContext, useCallback, useContext, useState } from 'react'
import { CheckCircle, XCircle, Info, X } from 'lucide-react'

// ─── Types ────────────────────────────────────────────────────────────────────

export type ToastType = 'success' | 'error' | 'info'

interface ToastItem {
  id: string
  message: string
  type: ToastType
}

interface ToastContextValue {
  toast: (message: string, type?: ToastType) => void
}

// ─── Context ──────────────────────────────────────────────────────────────────

const ToastContext = createContext<ToastContextValue>({ toast: () => {} })

export function useToast() {
  return useContext(ToastContext)
}

// ─── Provider ─────────────────────────────────────────────────────────────────

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<ToastItem[]>([])

  const removeToast = useCallback((id: string) => {
    setToasts(prev => prev.filter(t => t.id !== id))
  }, [])

  const toast = useCallback((message: string, type: ToastType = 'success') => {
    const id = Math.random().toString(36).slice(2)
    setToasts(prev => [...prev, { id, message, type }])
    setTimeout(() => removeToast(id), 3000)
  }, [removeToast])

  return (
    <ToastContext.Provider value={{ toast }}>
      {children}
      {/* Toast stack — fixed top-right */}
      <div className="fixed top-4 right-4 z-50 flex flex-col gap-2 max-w-sm w-full pointer-events-none">
        {toasts.map(t => (
          <ToastBanner key={t.id} item={t} onClose={() => removeToast(t.id)} />
        ))}
      </div>
    </ToastContext.Provider>
  )
}

// ─── Banner ───────────────────────────────────────────────────────────────────

const STYLES: Record<ToastType, { cls: string; icon: React.ReactNode }> = {
  success: { cls: 'bg-green-600 text-white',                      icon: <CheckCircle size={16} /> },
  error:   { cls: 'bg-red-600 text-white',                        icon: <XCircle size={16} /> },
  info:    { cls: 'bg-primary text-primary-foreground',           icon: <Info size={16} /> },
}

function ToastBanner({ item, onClose }: { item: ToastItem; onClose: () => void }) {
  const { cls, icon } = STYLES[item.type]
  return (
    <div className={`${cls} rounded-lg shadow-lg px-4 py-3 flex items-center gap-3 pointer-events-auto`}>
      {icon}
      <p className="text-sm flex-1">{item.message}</p>
      <button onClick={onClose} className="hover:opacity-70 transition-opacity">
        <X size={14} />
      </button>
    </div>
  )
}
