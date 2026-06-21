export default function Home() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-[#0a0e1a]">
      <div className="flex flex-col items-center gap-4 text-center">
        <div className="flex items-center gap-3">
          <div className="h-3 w-3 rounded-full bg-[#10b981] shadow-[0_0_12px_#10b981]" />
          <span className="text-2xl font-bold tracking-tight text-[#f1f5f9]">LiveInfra</span>
        </div>
        <p className="text-sm text-[#64748b]">
          Infrastructure coming online…
        </p>
      </div>
    </div>
  )
}
