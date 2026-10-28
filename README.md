# FortiGate Scripts

Gerador de scripts de CLI para FortiGate (FortiOS 7.x). Você escolhe um template, preenche o formulário e recebe o bloco de configuração pronto para colar no firewall, com observações sobre o que conferir antes de aplicar.

## Templates

| Categoria | Template | O que gera |
| --- | --- | --- |
| VPN IPsec | Site-to-site | Objetos e grupos, phase1 (IKEv1/v2, local ID, DPD), um seletor de phase2 por par de redes, rotas + blackhole e políticas nos dois sentidos. Mostra os parâmetros que o peer precisa casar. |
| VPN IPsec | Acesso remoto (FortiClient) | Dial-up com XAuth por grupo, pool de IPs, DNS, split tunnel (ou túnel completo com política de internet) e política para a LAN. |
| Políticas | Política de firewall | IPv4 policy com NAT e perfis UTM opcionais (SSL, AV, web filter, IPS, application control). |
| Políticas | VIP / port forward | VIP com port forward e política de entrada com IPS; alerta quando expõe RDP, SQL, SMB, SSH etc. |
| Objetos | Endereço, endereços em lote, grupos, serviços | `firewall address` (ipmask, iprange, FQDN), importação em lote `NOME;IP`, `addrgrp` (com append), `service custom` e `service group`. |
| Rede | Interface / VLAN, zona, rota estática | VLAN ou porta física com IP, role e allowaccess; servidor DHCP opcional; zonas; rotas com blackhole. |
| SD-WAN | Membros + health check | Membros com gateway, health check com SLA e rota padrão pela zona SD-WAN. |
| Autenticação | RADIUS + captive portal | Servidor RADIUS com accounting, grupo, captive portal interno ou externo e walled garden (security-exempt-list). |
| Diagnóstico | VPN, debug flow, sniffer, SD-WAN, saúde/HA | Blocos separados para iniciar e parar cada debug, com sintaxe ajustada para 7.0/7.2 ou 7.4+ quando muda. |

Entradas de rede aceitam `192.168.1.0/24` ou `192.168.1.0 255.255.255.0`. O backend valida IPs, máscaras, faixas de DHCP, limites de nome do FortiOS (15 caracteres para interfaces e túneis, 35 para políticas) e combinações inválidas, como GCM com IKEv1.

## Stack

- **Backend:** Node.js + Express + TypeScript (porta 3001)
- **Frontend:** Next.js + React + Bootstrap (porta 3000)

## Como rodar

```bash
cd backend-main && npm install && npm run dev
cd frontend-main && npm install && npm run dev
```

Abra http://localhost:3000. Cada template tem link direto, por exemplo `http://localhost:3000/#vpn-s2s`.

Variáveis opcionais: `PORT` e `CORS_ORIGIN` no backend, `NEXT_PUBLIC_API_URL` no frontend.

## API

- `GET /api/templates`: catálogo com os campos de cada template (o frontend monta os formulários a partir dele).
- `POST /api/generate` com `{ "action": "<id>", "payload": { ... } }`: retorna `{ script, notes, sections? }` ou `400` com `fieldErrors`.

## Adicionar um template

1. Crie um `TemplateDef` em `backend-main/src/services/fortigate/modules/` com `fields` (rótulo, tipo, formato, `showIf`) e `build()`, usando o `CliWriter` para gerar os blocos `config`/`edit`/`next`/`end`.
2. Inclua o array no registro em `backend-main/src/services/fortigate/index.ts`.
3. Adicione uma amostra em `backend-main/test/templates.test.ts` e rode `npm test`.

O formulário aparece no frontend sem nenhuma alteração.

> Revise sempre o script antes de aplicar em produção e nunca publique chaves pré-compartilhadas reais.

---
Feito por [Fábio Venceslau](https://fbvenceslau.github.io) · Analista de Redes NOC/SOC
