import express from 'express';
import cors from 'cors';
// Importando o seu controller (Lembre-se da extensão .js!)
import { generateScript } from './controllers/scriptController.js';

const app = express();
app.use(express.json());
app.use(cors({ origin: 'http://localhost:3000' })); 

// Conectando a rota /api/generate direto no seu controller
app.post('/api/generate', generateScript);

app.listen(3001, () => console.log('Backend Automator a correr na porta 3001'));