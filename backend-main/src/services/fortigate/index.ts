import { authTemplates } from './modules/auth.ts';
import { diagnosticTemplates } from './modules/diagnostics.ts';
import { networkTemplates } from './modules/network.ts';
import { objectTemplates } from './modules/objects.ts';
import { policyTemplates } from './modules/policies.ts';
import { sdwanTemplates } from './modules/sdwan.ts';
import { vpnTemplates } from './modules/vpn.ts';
import type { GenerateResult, TemplateDef, TemplateSummary } from './types.ts';
import { normalizePayload } from './validate.ts';

// Para adicionar um template novo: crie o TemplateDef num módulo e inclua o array aqui.
const templates: TemplateDef[] = [
  ...vpnTemplates,
  ...policyTemplates,
  ...objectTemplates,
  ...networkTemplates,
  ...sdwanTemplates,
  ...authTemplates,
  ...diagnosticTemplates,
];

const byId = new Map(templates.map((t) => [t.id, t]));
if (byId.size !== templates.length) throw new Error('IDs de template duplicados');

export const listTemplates = (): TemplateSummary[] =>
  templates.map(({ build: _build, ...summary }) => summary);

export const getTemplate = (id: string): TemplateDef | undefined => byId.get(id);

export const generate = (id: string, payload: unknown): GenerateResult => {
  const template = byId.get(id);
  if (!template) throw new Error(`Template desconhecido: ${id}`);
  return template.build(normalizePayload(template, payload));
};

export { ValidationError } from './types.ts';
