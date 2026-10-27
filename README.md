# FortiGate Scripts

Gerador de scripts de CLI para FortiGate (FortiOS). Você preenche um formulário na web e recebe o bloco de configuração pronto para colar no firewall.

## O que gera

| Módulo | Configuração gerada |
| --- | --- |
| Interfaces | `config system interface`: IP, máscara, alias e acessos administrativos (ping, https, ssh) |
| Objetos de endereço | `config firewall address`: objetos do tipo ipmask |
| VPN site-to-site | `config vpn ipsec phase1-interface` e `phase2-interface`: túnel IPsec com AES256-SHA256 entre duas redes |

## Stack

- **Backend:** Node.js + Express + TypeScript (porta 3001)
- **Frontend:** Next.js + React

## Como rodar

```bash
cd backend-main && npm install && npm run dev
cd frontend-main && npm install && npm run dev
```

Abra http://localhost:3000.

> Revise sempre o script antes de aplicar em produção e nunca publique chaves pré-compartilhadas reais.

---
Feito por [Fábio Venceslau](https://fbvenceslau.github.io) · Analista de Redes NOC/SOC
