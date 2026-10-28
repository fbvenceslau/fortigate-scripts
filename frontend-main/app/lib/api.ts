// Tipos espelhados do catálogo do backend (backend-main/src/services/fortigate/types.ts).

export type FieldType = 'text' | 'password' | 'number' | 'select' | 'checkbox' | 'multi' | 'list' | 'lines';
export type FieldValue = string | boolean | string[];
export type FormValues = Record<string, FieldValue>;

export interface FieldDef {
  name: string;
  label: string;
  type: FieldType;
  required?: boolean;
  placeholder?: string;
  help?: string;
  default?: FieldValue;
  options?: { value: string; label: string }[];
  maxLength?: number;
  min?: number;
  max?: number;
  showIf?: { field: string; equals: Array<string | boolean> };
  section?: string;
}

export interface Template {
  id: string;
  category: string;
  title: string;
  description: string;
  fields: FieldDef[];
}

export interface GenerateResult {
  script: string;
  notes: string[];
  sections?: { title: string; script: string }[];
}

export class ApiError extends Error {
  constructor(message: string, public readonly fieldErrors: Record<string, string> = {}) {
    super(message);
  }
}

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001';

const request = async <T,>(path: string, init?: RequestInit): Promise<T> => {
  let response: Response;
  try {
    response = await fetch(`${API_URL}${path}`, {
      ...init,
      headers: { 'Content-Type': 'application/json', ...init?.headers },
    });
  } catch {
    throw new ApiError(`Backend indisponível em ${API_URL}. Ele está rodando?`);
  }
  const body = await response.json().catch(() => ({}));
  if (!response.ok) throw new ApiError(body.error ?? 'Erro inesperado', body.fieldErrors);
  return body as T;
};

export const fetchTemplates = () =>
  request<{ templates: Template[] }>('/api/templates').then((r) => r.templates);

export const generateScript = (action: string, payload: FormValues) =>
  request<GenerateResult>('/api/generate', { method: 'POST', body: JSON.stringify({ action, payload }) });

export const isVisible = (field: FieldDef, values: FormValues): boolean =>
  !field.showIf || field.showIf.equals.includes(values[field.showIf.field] as string | boolean);

export const defaultValues = (template: Template): FormValues =>
  Object.fromEntries(
    template.fields.map((f) => [
      f.name,
      f.default ?? (f.type === 'checkbox' ? false : f.type === 'multi' ? [] : ''),
    ]),
  );
