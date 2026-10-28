'use client';

import { Fragment } from 'react';
import { isVisible, type FieldDef, type FieldValue, type FormValues } from '../lib/api';

interface Props {
  fields: FieldDef[];
  values: FormValues;
  errors: Record<string, string>;
  onChange: (name: string, value: FieldValue) => void;
}

const wide = (f: FieldDef) => f.type === 'lines' || f.type === 'checkbox' || f.type === 'multi';

function FieldInput({ field, value, invalid, onChange }: {
  field: FieldDef;
  value: FieldValue;
  invalid: boolean;
  onChange: (value: FieldValue) => void;
}) {
  const id = `f-${field.name}`;
  const cls = `form-control${invalid ? ' is-invalid' : ''}`;

  switch (field.type) {
    case 'checkbox':
      return (
        <div className="form-check form-switch">
          <input id={id} className="form-check-input" type="checkbox" role="switch"
            checked={value === true} onChange={(e) => onChange(e.target.checked)} />
          <label className="form-check-label" htmlFor={id}>{field.label}</label>
        </div>
      );

    case 'multi': {
      const selected = Array.isArray(value) ? value : [];
      return (
        <div className="d-flex flex-wrap gap-3">
          {field.options?.map((o) => (
            <div className="form-check" key={o.value}>
              <input id={`${id}-${o.value}`} className="form-check-input" type="checkbox"
                checked={selected.includes(o.value)}
                onChange={(e) => onChange(e.target.checked ? [...selected, o.value] : selected.filter((s) => s !== o.value))} />
              <label className="form-check-label font-monospace small" htmlFor={`${id}-${o.value}`}>{o.label}</label>
            </div>
          ))}
        </div>
      );
    }

    case 'select':
      return (
        <select id={id} className={`form-select${invalid ? ' is-invalid' : ''}`}
          value={String(value)} onChange={(e) => onChange(e.target.value)}>
          {field.options?.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
        </select>
      );

    case 'lines':
      return (
        <textarea id={id} className={`${cls} font-monospace`} rows={5}
          placeholder={field.placeholder} value={String(value)} onChange={(e) => onChange(e.target.value)} />
      );

    default:
      return (
        <input id={id} className={cls}
          type={field.type === 'password' ? 'password' : field.type === 'number' ? 'number' : 'text'}
          autoComplete={field.type === 'password' ? 'new-password' : 'off'}
          min={field.min} max={field.max} maxLength={field.maxLength}
          placeholder={field.placeholder}
          value={Array.isArray(value) ? value.join(', ') : String(value)}
          onChange={(e) => onChange(e.target.value)} />
      );
  }
}

export default function TemplateForm({ fields, values, errors, onChange }: Props) {
  return (
    <div className="row g-3">
      {fields.filter((f) => isVisible(f, values)).map((field) => (
        <Fragment key={field.name}>
          {field.section && (
            <div className="col-12 pt-2">
              <h6 className="text-uppercase text-secondary small fw-semibold border-bottom pb-1 mb-0">{field.section}</h6>
            </div>
          )}
          <div className={wide(field) ? 'col-12' : 'col-md-6'}>
            {field.type !== 'checkbox' && (
              <label className="form-label small fw-semibold" htmlFor={`f-${field.name}`}>
                {field.label}{field.required && <span className="text-danger"> *</span>}
              </label>
            )}
            <FieldInput field={field} value={values[field.name] ?? ''} invalid={!!errors[field.name]}
              onChange={(value) => onChange(field.name, value)} />
            {errors[field.name]
              ? <div className="invalid-feedback d-block">{errors[field.name]}</div>
              : field.help && <div className="form-text">{field.help}</div>}
          </div>
        </Fragment>
      ))}
    </div>
  );
}
