// app/page.tsx
import 'bootstrap/dist/css/bootstrap.min.css';
import InterfaceGenerator from './components/InterfaceGenerator';
import ObjectGenerator from './components/ObjectGenerator';
import VpnGenerator from './components/VpnGenerator';

export default function Home() {
  return (
    <main className="container mt-5">
      <div className="d-flex align-items-center mb-4">
        {/* Adicione a sua logo aqui */}
        <h2>Automação de Scripts FortiGate</h2>
      </div>
      
      <div className="row">
        <div className="col-lg-8 mx-auto">
            <InterfaceGenerator />
            <ObjectGenerator />
            <VpnGenerator />
        </div>
      </div>
    </main>
  );
}