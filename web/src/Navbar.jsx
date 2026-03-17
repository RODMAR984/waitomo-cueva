export default function Navbar() {
  return (
    <nav className="bg-slate-950 border-b border-slate-800">
      <div className="max-w-6xl mx-auto px-4 flex items-center h-14">
        <div className="logo-cyan-hover cursor-default">
          <img
            src="/logo-fitengine.svg"
            alt="FitEngine"
            className="h-[45px] w-auto transition-[filter] duration-300"
          />
        </div>
      </div>
    </nav>
  )
}
