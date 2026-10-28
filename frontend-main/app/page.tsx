import Generator from './components/Generator';

export default function Home() {
  return (
    <>
      <header className="app-header mb-4">
        <div className="container py-3">
          <h1 className="h4 mb-0">FortiGate Scripts</h1>
          <p className="small mb-0 opacity-75">Gerador de CLI para FortiOS 7.x · revise sempre antes de aplicar em produção</p>
        </div>
      </header>
      <main className="container pb-5">
        <Generator />
      </main>
    </>
  );
}
