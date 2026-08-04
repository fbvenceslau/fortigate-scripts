'use client';

import { useState } from 'react';
import axios from 'axios';

export default function InterfaceGenerator() {
  const [formData, setFormData] = useState({
    name: '',
    alias: '',
    ip: '',
    mask: '255.255.255.0',
    allowaccess: ''
  });
  const [generatedScript, setGeneratedScript] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    // Transforma a string "ping, https" num array ["ping", "https"][cite: 3]
    const accessArray = formData.allowaccess.split(',').map(i => i.trim());

    try {
      const response = await axios.post(
        'http://localhost:3001/api/generate',
        { 
          action: 'CREATE_INTERFACE', // Mudou de type para action
          payload: {
            ...formData,
            allowaccess: accessArray
          } 
        },
        { withCredentials: true }
      );
      setGeneratedScript(response.data.script);
    } catch (error) {
      console.error('Erro ao gerar script', error);
    }
  };

  return (
    <div className="card p-4 shadow-sm mb-4">
      <h4 className="mb-3">Criar Interface de Rede</h4>
      <form onSubmit={handleSubmit}>
        <div className="row mb-3">
          <div className="col-md-6">
            <label className="form-label">Nome da Interface (ex: port1, vlan10)</label>
            <input type="text" className="form-control" required
              onChange={e => setFormData({...formData, name: e.target.value})} />
          </div>
          <div className="col-md-6">
            <label className="form-label">Alias (Descrição)</label>
            <input type="text" className="form-control" placeholder="ex: LINK_PRINCIPAL"
              onChange={e => setFormData({...formData, alias: e.target.value})} />
          </div>
        </div>
        <div className="row mb-3">
          <div className="col-md-4">
            <label className="form-label">Endereço IP</label>
            <input type="text" className="form-control" placeholder="ex: 192.168.1.1" required
              onChange={e => setFormData({...formData, ip: e.target.value})} />
          </div>
          <div className="col-md-4">
            <label className="form-label">Máscara Sub-rede</label>
            <input type="text" className="form-control" defaultValue="255.255.255.0" required
              onChange={e => setFormData({...formData, mask: e.target.value})} />
          </div>
          <div className="col-md-4">
            <label className="form-label">Allow Access (separado por vírgula)</label>
            <input type="text" className="form-control" placeholder="ex: ping, https, ssh" required
              onChange={e => setFormData({...formData, allowaccess: e.target.value})} />
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