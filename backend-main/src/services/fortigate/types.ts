// Tipos compartilhados do catálogo de templates.
// Cada template declara os campos do formulário (serializados para o frontend)
// e a função que gera o script a partir dos valores já validados.

export type FieldType =
  | 'text'      // linha única
  | 'password'  // linha única, mascarada no formulário
  | 'number'
  | 'select'
  | 'checkbox'
  | 'multi'     // grupo de checkboxes -> string[]
  | 'list'      // itens separados por vírgula ou quebra de linha -> string[]
  | 'lines';    // área de texto, uma entrada por linha -> string[]

// Formatos validados no backend antes da geração.
export type FieldFormat =
  | 'name'          // nome de objeto FortiOS (sem aspas)
  | 'ipv4'          // 192.168.1.1
  | 'subnet'        // rede: 192.168.1.0/24 ou 192.168.1.0 255.255.255.0 (bits de host zerados)
  | 'host-or-subnet'// aceita IP solto (vira /32) ou rede
  | 'ip-cidr'       // IP de interface com máscara: 192.168.1.1/24 (bits de host permitidos)
  | 'fqdn'
  | 'host'          // IPv4 ou FQDN
  | 'port-range'    // 443 ou 8000-8100
  | 'url';

export interface FieldOption {
  value: string;
  label: string;
}

export interface FieldDef {
  name: string;
  label: string;
  type: FieldType;
  required?: boolean;
  placeholder?: string;
  help?: string;
  default?: string | boolean | string[];
  options?: FieldOption[];
  format?: FieldFormat;
  maxLength?: number;
  min?: number;
  max?: number;
  // Só exibe/valida o campo quando outro campo tem um destes valores.
  showIf?: { field: string; equals: Array<string | boolean> };
  // Título de seção no formulário (o campo inicia uma nova seção).
  section?: string;
}

export type Value = string | boolean | string[];
export type Values = Record<string, Value>;

export interface GenerateResult {
  script: string;
  notes: string[];
  // Blocos executados em etapas (ex.: iniciar e parar debug), cada um copiável.
  sections?: Array<{ title: string; script: string }>;
}

export interface TemplateDef {
  id: string;
  category: string;
  title: string;
  description: string;
  fields: FieldDef[];
  build(values: Values): GenerateResult;
}

export type TemplateSummary = Omit<TemplateDef, 'build'>;

export class ValidationError extends Error {
  constructor(public readonly fieldErrors: Record<string, string>) {
    super('Dados inválidos');
  }
}
