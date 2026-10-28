import type { Request, Response } from 'express';
import { generate, getTemplate, listTemplates, ValidationError } from '../services/fortigate/index.ts';

export const getTemplates = (_req: Request, res: Response) => {
  res.json({ templates: listTemplates() });
};

export const generateScript = (req: Request, res: Response) => {
  const { action, payload } = req.body ?? {};

  if (typeof action !== 'string' || !getTemplate(action)) {
    return res.status(400).json({ error: 'Template não suportado.' });
  }

  try {
    return res.status(200).json(generate(action, payload));
  } catch (error) {
    if (error instanceof ValidationError) {
      return res.status(400).json({ error: 'Verifique os campos destacados.', fieldErrors: error.fieldErrors });
    }
    console.error(error);
    return res.status(500).json({ error: 'Erro ao gerar script.' });
  }
};
