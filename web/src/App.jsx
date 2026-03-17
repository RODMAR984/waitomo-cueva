import Navbar from './Navbar'

function App() {
  return (
    <div className="min-h-screen bg-slate-950">
      <Navbar />
      <main className="max-w-4xl mx-auto px-4 py-12">
        <p className="text-secondary text-lg">
          Contenido de la app. Los textos secundarios usan el gris metálico del logo.
        </p>
        <button
          type="button"
          className="mt-6 px-6 py-3 bg-primary text-slate-950 font-semibold rounded-lg btn-glow hover:bg-primary/90 transition"
        >
          Botón con glow cian
        </button>
      </main>
    </div>
  )
}

export default App
