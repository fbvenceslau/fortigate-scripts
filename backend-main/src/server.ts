import express from 'express';
import cors from 'cors';
import { generateScript, getTemplates } from './controllers/scriptController.ts';

const PORT = Number(process.env.PORT ?? 3001);
const ORIGINS = (process.env.CORS_ORIGIN ?? 'http://localhost:3000').split(',');

const app = express();
app.use(express.json({ limit: '100kb' }));
app.use(cors({ origin: ORIGINS }));

app.get('/api/templates', getTemplates);
app.post('/api/generate', generateScript);

app.listen(PORT, () => console.log(`Backend FortiGate Scripts na porta ${PORT}`));
