'use client';

import { useEffect, useMemo, useState } from 'react';
import {
  ApiError, defaultValues, fetchTemplates, generateScript,
  type FieldValue, type FormValues, type GenerateResult, type Template,
} from '../lib/api';
import ScriptOutput from './ScriptOutput';
import TemplateForm from './TemplateForm';

const omit = <T,>(obj: Record<string, T>, key: string): Record<string, T> =>
  Object.fromEntries(Object.entries(obj).filter(([k]) => k !== key));

export default function Generator() {
  const [templates, setTemplates] = useState<Template[]>([]);
  const [loadError, setLoadError] = useState('');
  const [activeId, setActiveId] = useState('');
  const [search, setSearch] = useState('');
  // Valores por template: trocar de template e voltar não perde o que foi digitado.
  const [valuesById, setValuesById] = useState<Record<string, FormValues>>({});
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState('');
  const [result, setResult] = useState<GenerateResult | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    fetchTemplates()
      .then((list) => {
        setTemplates(list);
        const fromHash = window.location.hash.slice(1);
        setActiveId(list.some((t) => t.id === fromHash) ? fromHash : list[0]?.id ?? '');
      })
      .catch((e: Error) => setLoadError(e.message));
  }, []);

  // Acompanha o #hash da URL (links diretos e botão voltar do navegador).
  useEffect(() => {
    const onHash = () => {
      const id = window.location.hash.slice(1);
      if (templates.some((t) => t.id === id)) {
        setActiveId(id);
        setResult(null);
        setErrors({});
        setFormError('');
      }
    };
    window.addEventListener('hashchange', onHash);
    return () => window.removeEventListener('hashchange', onHash);
  }, [templates]);

  const active = templates.find((t) => t.id === activeId);
  const values = active ? valuesById[active.id] ?? defaultValues(active) : {};

  const grouped = useMemo(() => {
    const term = search.trim().toLowerCase();
    const groups = new Map<string, Template[]>();
    for (const t of templates) {
      const haystack = `${t.category} ${t.title} ${t.description}`.toLowerCase();
      if (term && !haystack.includes(term)) continue;
      groups.set(t.category, [...(groups.get(t.category) ?? []), t]);
    }
    return [...groups.entries()];
  }, [templates, search]);

  const select = (id: string) => {
    setActiveId(id);
    setResult(null);
    setErrors({});
    setFormError('');
    window.history.replaceState(null, '', `#${id}`);
  };

  const change = (name: string, value: FieldValue) => {
    if (!active) return;
    setValuesById((prev) => ({ ...prev, [active.id]: { ...values, [name]: value } }));
    setErrors((prev) => omit(prev, name));
  };

  const reset = () => {
    if (!active) return;
    setValuesById((prev) => omit(prev, active.id));
    setErrors({});
    setFormError('');
    setResult(null);
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!active) return;
    setLoading(true);
    setFormError('');
    try {
      setResult(await generateScript(active.id, values));
      setErrors({});
    } catch (error) {
      setResult(null);
      if (error instanceof ApiError) {
        setErrors(error.fieldErrors);
        setFormError(error.message);
      } else {
        setFormError('Erro inesperado ao gerar o script.');
      }
    } finally {
      setLoading(false);
    }
  };

  if (loadError) {
    return <div className="alert alert-danger">{loadError}</div>;
  }

  return (
    <div className="row g-4">
      <aside className="col-lg-3">
        <input type="search" className="form-control form-control-sm mb-3" placeholder="Buscar template…"
          value={search} onChange={(e) => setSearch(e.target.value)} />
        <nav className="template-nav">
          {grouped.map(([category, items]) => (
            <div key={category} className="mb-3">
              <div className="text-uppercase text-secondary small fw-semibold mb-1 px-2">{category}</div>
              <div className="list-group list-group-flush">
                {items.map((t) => (
                  <button key={t.id} type="button" onClick={() => select(t.id)}
                    className={`list-group-item list-group-item-action border-0 rounded py-1 px-2 small${t.id === activeId ? ' active' : ''}`}>
                    {t.title}
                  </button>
                ))}
              </div>
            </div>
          ))}
          {templates.length > 0 && grouped.length === 0 && <p className="small text-secondary px-2">Nada encontrado.</p>}
        </nav>
      </aside>

      <section className="col-lg-9">
        {!active ? (
          <div className="text-secondary">Carregando templates…</div>
        ) : (
          <div className="card shadow-sm">
            <div className="card-body p-4">
              <div className="small text-secondary">{active.category}</div>
              <h4 className="mb-1">{active.title}</h4>
              <p className="text-secondary mb-4">{active.description}</p>

              <form onSubmit={submit} noValidate>
                <TemplateForm fields={active.fields} values={values} errors={errors} onChange={change} />
                {formError && <div className="alert alert-danger small py-2 mt-3 mb-0">{formError}</div>}
                <div className="d-flex gap-2 mt-4">
                  <button type="submit" className="btn btn-primary flex-grow-1" disabled={loading}>
                    {loading ? 'Gerando…' : 'Gerar script'}
                  </button>
                  <button type="button" className="btn btn-outline-secondary" onClick={reset}>Limpar</button>
                </div>
              </form>

              {result && <ScriptOutput result={result} fileName={active.id} />}
            </div>
          </div>
        )}
      </section>
    </div>
  );
}
