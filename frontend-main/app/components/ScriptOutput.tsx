'use client';

import { useState } from 'react';
import type { GenerateResult } from '../lib/api';

function CodeBlock({ title, script }: { title?: string; script: string }) {
  const [copied, setCopied] = useState(false);

  const copy = async () => {
    await navigator.clipboard.writeText(script);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  return (
    <div className="mb-3">
      <div className="d-flex align-items-center justify-content-between mb-1">
        <span className="small fw-semibold text-secondary">{title}</span>
        <button type="button" className="btn btn-sm btn-outline-secondary" onClick={copy}>
          {copied ? 'Copiado!' : 'Copiar'}
        </button>
      </div>
      <pre className="script-output rounded p-3 mb-0"><code>{script}</code></pre>
    </div>
  );
}

export default function ScriptOutput({ result, fileName }: { result: GenerateResult; fileName: string }) {
  const download = () => {
    const url = URL.createObjectURL(new Blob([result.script + '\n'], { type: 'text/plain' }));
    const a = document.createElement('a');
    a.href = url;
    a.download = `${fileName}.txt`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="mt-4">
      {result.notes.length > 0 && (
        <div className="alert alert-warning small py-2">
          <ul className="mb-0 ps-3">
            {result.notes.map((note) => <li key={note}>{note}</li>)}
          </ul>
        </div>
      )}

      {result.sections?.length
        ? result.sections.map((s) => <CodeBlock key={s.title} title={s.title} script={s.script} />)
        : <CodeBlock title="Script" script={result.script} />}

      <button type="button" className="btn btn-sm btn-link px-0" onClick={download}>Baixar .txt</button>
    </div>
  );
}
