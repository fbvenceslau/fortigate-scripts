'use client';

import { useState } from 'react';
import axios from 'axios';

export default function VpnGenerator() {
  const [formData, setFormData] = useState({
    name: '',
    interfaceName: '',
    remoteGw: '',
    psk: '',
    localSubnet: '',
    remoteSubnet: ''
  });
  const [generatedScript, setGeneratedScript] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const response = await axios.post(
        'http://localhost:3001/api/generate',
        { 
          action: 'CREATE_VPN_S2S', // Mudou de type para action
          payload: formData 
        },
        // { withCredentials: true }
      );
      setGeneratedScript(response.data.script);
    } catch (error) {
      console.error('Erro ao gerar script', error);
    }
  };

  return (
    <div className="card p-4 shadow-sm mb-4">
      <h4 className="mb-3">Criar VPN Forticlient</h4>
      <form onSubmit={handleSubmit}>
        
        <div className="row mb-3">
          <div className="col-md-6">
            <label className="form-label">Nome da VPN (ex: IPSEC_CLIENT)</label>
            <input type="text" className="form-control" required
              onChange={e => setFormData({...formData, name: e.target.value})} />
          </div>
          <div className="col-md-6">
            <label className="form-label">Interface de Saída (ex: wan1)</label>
            <input type="text" className="form-control" required
              onChange={e => setFormData({...formData, interfaceName: e.target.value})} />
          </div>
        </div>

        <div className="row mb-3">
          <div className="col-md-6">
            <label className="form-label">Remote Gateway (IP Público do destino)</label>
            <input type="text" className="form-control" placeholder="ex: 200.200.200.200" required
              onChange={e => setFormData({...formData, remoteGw: e.target.value})} />
          </div>
          <div className="col-md-6">
            <label className="form-label">Pre-Shared Key (Senha)</label>
            <input type="password" className="form-control" required
              onChange={e => setFormData({...formData, psk: e.target.value})} />
          </div>
        </div>

        <div className="row mb-3">
          <div className="col-md-6">
            <label className="form-label">Rede Local (Local Subnet)</label>
            <input type="text" className="form-control" placeholder="ex: 192.168.1.0 255.255.255.0" required
              onChange={e => setFormData({...formData, localSubnet: e.target.value})} />
          </div>
          <div className="col-md-6">
            <label className="form-label">Rede Remota (Remote Subnet)</label>
            <input type="text" className="form-control" placeholder="ex: 10.0.0.0 255.255.255.0" required
              onChange={e => setFormData({...formData, remoteSubnet: e.target.value})} />
          </div>
        </div>

        <button type="submit" className="btn btn-primary w-100">Gerar Script CLI</button>
      </form>

      {generatedScript && (
        <div className="mt-4">
          <h5>Script Gerado (Copie e cole no terminal):</h5>
          <pre className="bg-dark text-success p-3 rounded">
            <code>{generatedScript}</code>
          </pre>
          <button className="btn btn-outline-secondary btn-sm" 
            onClick={() => navigator.clipboard.writeText(generatedScript)}>
            Copiar Script
          </button>
        </div>
      )}
    </div>
  );
}