'use client';

import { useState } from 'react';
import axios from 'axios';

export default function ObjectGenerator() {
  const [formData, setFormData] = useState({ name: '', ip: '', mask: '255.255.255.255' });
  const [generatedScript, setGeneratedScript] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    try {
      const response = await axios.post(
        'http://localhost:3001/api/generate',
        { 
          action: 'CREATE_ADDRESS', // Alinhado com o controller do backend
          payload: {
            name: formData.name,
            ip: formData.ip,
            mask: formData.mask
          } 
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
      <h4 className="mb-3">Criar Objeto de Endereço (Address)</h4>
      <form onSubmit={handleSubmit}>
        <div className="mb-3">
          <label className="form-label">Nome do Objeto (ex: ADDR_SERVIDOR_WEB)</label>
          <input type="text" className="form-control" required
            onChange={e => setFormData({...formData, name: e.target.value})} />
        </div>
        <div className="row mb-3">
          <div className="col-md-6">
            <label className="form-label">Endereço IP</label>
            <input type="text" className="form-control" placeholder="ex: 192.168.1.100" required
              onChange={e => setFormData({...formData, ip: e.target.value})} />
          </div>
          <div className="col-md-6">
            <label className="form-label">Máscara de Sub-rede</label>
            <input type="text" className="form-control" defaultValue="255.255.255.255" required
              onChange={e => setFormData({...formData, mask: e.target.value})} />
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