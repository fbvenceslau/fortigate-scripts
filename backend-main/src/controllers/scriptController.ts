import { type Request, type Response } from 'express';
import { FortiGateCLI } from '../services/fortigateGenerator.ts';

export const generateScript = (req: Request, res: Response) => {
  const { action, payload } = req.body;
  const fgGenerator = new FortiGateCLI();
  let scriptOutput = '';

  try {
    switch (action) {
      case 'CREATE_ADDRESS':
        scriptOutput = FortiGateCLI.createAddress(payload);
        break;
      case 'CREATE_INTERFACE':
        scriptOutput = FortiGateCLI.createInterface(payload);
        break;
      case 'CREATE_VPN_S2S':
        scriptOutput = FortiGateCLI.createVpnSiteToSite(payload);
        break;
      default:
        return res.status(400).json({ error: 'Ação não suportada pelo FortiGate.' });
    }

    return res.status(200).json({ script: scriptOutput });
  } catch (error) {
    return res.status(500).json({ error: 'Erro ao gerar script.' });
  }
};