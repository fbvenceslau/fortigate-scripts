import { isIpv4, netToString, parseNet } from './cli.ts';
import {
  ValidationError,
  type FieldDef,
  type FieldFormat,
  type TemplateDef,
  type Value,
  type Values,
} from './types.ts';

const NAME_RE = /^[^"\\?]+$/;
const FQDN_RE = /^(\*\.)?([a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,63}$/i;
const URL_RE = /^https?:\/\/[^\s"]+$/i;

// Valida e normaliza um item. Retorna [valorNormalizado, erro].
const checkFormat = (format: FieldFormat, value: string): [string, string | null] => {
  switch (format) {
    case 'name':
      return [value, NAME_RE.test(value) ? null : 'Não use aspas, barra invertida ou "?"'];
    case 'ipv4':
      return [value, isIpv4(value) ? null : 'IPv4 inválido'];
    case 'subnet':
    case 'host-or-subnet':
    case 'ip-cidr': {
      const net = parseNet(value, {
        allowBareIp: format === 'host-or-subnet',
        allowHostBits: format === 'ip-cidr',
      });
      return typeof net === 'string' ? [value, net] : [netToString(net), null];
    }
    case 'fqdn':
      return [value, FQDN_RE.test(value) ? null : 'FQDN inválido'];
    case 'host':
      return [value, isIpv4(value) || FQDN_RE.test(value) ? null : 'Informe um IPv4 ou FQDN'];
    case 'port-range': {
      const m = /^(\d{1,5})(?:-(\d{1,5}))?$/.exec(value);
      const lo = Number(m?.[1]);
      const hi = m?.[2] ? Number(m[2]) : lo;
      const ok = !!m && lo >= 1 && hi <= 65535 && lo <= hi;
      return [value, ok ? null : 'Porta ou faixa inválida (ex.: 443 ou 8000-8100)'];
    }
    case 'url':
      return [value, URL_RE.test(value) ? null : 'URL inválida (http:// ou https://)'];
  }
};

const splitList = (raw: unknown, separator: RegExp): string[] => {
  const items = Array.isArray(raw) ? raw.map(String) : String(raw ?? '').split(separator);
  return items.map((item) => item.trim()).filter(Boolean);
};

const emptyOf = (field: FieldDef): Value =>
  field.type === 'checkbox' ? false : ['multi', 'list', 'lines'].includes(field.type) ? [] : '';

const isVisible = (field: FieldDef, values: Values): boolean =>
  !field.showIf || field.showIf.equals.includes(values[field.showIf.field] as string | boolean);

export const normalizePayload = (template: TemplateDef, payload: unknown): Values => {
  const input = (payload && typeof payload === 'object' ? payload : {}) as Record<string, unknown>;
  const values: Values = {};
  const errors: Record<string, string> = {};

  for (const field of template.fields) {
    if (!isVisible(field, values)) {
      values[field.name] = emptyOf(field);
      continue;
    }
    const raw = input[field.name] ?? field.default;

    switch (field.type) {
      case 'checkbox':
        values[field.name] = raw === true || raw === 'true';
        break;

      case 'multi': {
        const allowed = new Set(field.options?.map((o) => o.value));
        const items = splitList(raw, /,/).filter((item) => allowed.has(item));
        if (field.required && items.length === 0) errors[field.name] = 'Selecione ao menos uma opção';
        values[field.name] = items;
        break;
      }

      case 'list':
      case 'lines': {
        const items = splitList(raw, field.type === 'list' ? /[,\n]/ : /\n/);
        if (field.required && items.length === 0) {
          errors[field.name] = 'Campo obrigatório';
        }
        const normalized: string[] = [];
        for (const item of items) {
          let value = item;
          if (field.format) {
            const [norm, err] = checkFormat(field.format, item);
            if (err) {
              errors[field.name] ??= `"${item}": ${err}`;
            }
            value = norm;
          }
          if (field.maxLength && value.length > field.maxLength) {
            errors[field.name] ??= `"${item}": máximo de ${field.maxLength} caracteres`;
          }
          normalized.push(value);
        }
        values[field.name] = normalized;
        break;
      }

      default: {
        let value = field.type === 'password' ? String(raw ?? '') : String(raw ?? '').trim();
        if (value === '') {
          if (field.required) errors[field.name] = 'Campo obrigatório';
          values[field.name] = '';
          break;
        }
        if (field.type === 'select' && !field.options?.some((o) => o.value === value)) {
          errors[field.name] = 'Opção inválida';
        }
        if (field.type === 'number') {
          const n = Number(value);
          if (!Number.isInteger(n)) errors[field.name] = 'Informe um número inteiro';
          else if (field.min !== undefined && n < field.min) errors[field.name] = `Mínimo ${field.min}`;
          else if (field.max !== undefined && n > field.max) errors[field.name] = `Máximo ${field.max}`;
        }
        if (field.format) {
          const [norm, err] = checkFormat(field.format, value);
          if (err) errors[field.name] = err;
          value = norm;
        }
        if (field.type === 'password' && /["\\]/.test(value)) {
          errors[field.name] = 'Não use aspas nem barra invertida';
        }
        if (field.maxLength && value.length > field.maxLength) {
          errors[field.name] = `Máximo de ${field.maxLength} caracteres`;
        }
        values[field.name] = value;
      }
    }
  }

  if (Object.keys(errors).length > 0) throw new ValidationError(errors);
  return values;
};

export const str = (v: Values, key: string): string => {
  const value = v[key];
  return typeof value === 'string' ? value : '';
};
export const bool = (v: Values, key: string): boolean => v[key] === true;
export const list = (v: Values, key: string): string[] => {
  const value = v[key];
  return Array.isArray(value) ? value : [];
};
