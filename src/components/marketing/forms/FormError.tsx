export default function FormError({ children }: { children: React.ReactNode }) {
  return <p className="mt-1.5 text-xs text-destructive">{children}</p>
}
