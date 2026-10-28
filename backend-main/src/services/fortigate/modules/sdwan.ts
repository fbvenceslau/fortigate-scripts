import { CliWriter, isIpv4 } from '../cli.ts';
import { ValidationError, type TemplateDef } from '../types.ts';
import { bool, list, str } from '../validate.ts';

export const sdwanTemplates: TemplateDef[] = [
  {
    id: 'sdwan',
    category: 'SD-WAN',
    title: 'Membros + health check',
    description: 'Habilita SD-WAN com os links, cria o SLA de monitoramento e a rota padrão (FortiOS 7.x).',
    fields: [
      {
        name: 'members', label: 'Links (um por linha: interface;gateway)', type: 'lines', required: true,
        placeholder: 'wan1;200.10.10.1\nwan2;189.20.20.1\nwan3 (PPPoE/DHCP: sem gateway)',
        help: 'Deixe o gateway em branco para links DHCP ou PPPoE.',
      },
      { name: 'zone', label: 'Zona SD-WAN', type: 'text', format: 'name', default: 'virtual-wan-link' },
      { name: 'hcName', label: 'Nome do health check', type: 'text', required: true, format: 'name', maxLength: 35, default: 'HC-INTERNET', section: 'Health check' },
      { name: 'servers', label: 'Servidores monitorados', type: 'list', required: true, format: 'host', default: '8.8.8.8, 1.1.1.1' },
      {
        name: 'protocol', label: 'Protocolo', type: 'select', default: 'ping',
        options: [{ value: 'ping', label: 'Ping' }, { value: 'http', label: 'HTTP' }, { value: 'dns', label: 'DNS' }],
      },
      { name: 'latency', label: 'Latência máx. (ms)', type: 'number', default: '150', min: 1, max: 10000 },
      { name: 'jitter', label: 'Jitter máx. (ms)', type: 'number', default: '30', min: 1, max: 10000 },
      { name: 'loss', label: 'Perda máx. (%)', type: 'number', default: '2', min: 0, max: 100 },
      { name: 'defaultRoute', label: 'Criar rota padrão pela zona SD-WAN', type: 'checkbox', default: true },
    ],
    build(v) {
      const errors: string[] = [];
      const members = list(v, 'members').map((line, i) => {
        const [intf = '', gw = ''] = line.split(/[;\t]/).map((p) => p.trim());
        const cleanIntf = intf.split(/\s/)[0] ?? '';
        if (!cleanIntf || /["\\?]/.test(cleanIntf)) errors.push(`Linha ${i + 1}: interface inválida`);
        if (gw && !isIpv4(gw)) errors.push(`Linha ${i + 1}: gateway inválido`);
        return { intf: cleanIntf, gw };
      });
      if (members.length < 2) errors.push('Informe ao menos dois links');
      if (errors.length) throw new ValidationError({ members: errors.slice(0, 3).join(' · ') });

      const zone = str(v, 'zone') || 'virtual-wan-link';
      const cli = new CliWriter();
      cli.config('system sdwan', () => {
        cli.set('status', 'enable');
        if (zone !== 'virtual-wan-link') {
          cli.config('zone', () => cli.edit(zone, () => {}));
        }
        cli.config('members', () => {
          members.forEach((m, i) => {
            cli.edit(i + 1, () => {
              cli.setq('interface', m.intf);
              cli.setq('zone', zone);
              if (m.gw) cli.set('gateway', m.gw);
            });
          });
        });
        cli.config('health-check', () => {
          cli.edit(str(v, 'hcName'), () => {
            cli.setq('server', ...list(v, 'servers').slice(0, 2));
            if (str(v, 'protocol') !== 'ping') cli.set('protocol', str(v, 'protocol'));
            cli.set('members', members.map((_, i) => i + 1).join(' '));
            cli.config('sla', () => {
              cli.edit(1, () => {
                cli.set('latency-threshold', str(v, 'latency'));
                cli.set('jitter-threshold', str(v, 'jitter'));
                cli.set('packetloss-threshold', str(v, 'loss'));
              });
            });
          });
        });
      });

      if (bool(v, 'defaultRoute')) {
        cli.config('router static', () => {
          cli.edit(0, () => cli.setq('sdwan-zone', zone).setq('comment', 'Default via SD-WAN'));
        });
      }

      const notes = [
        'Interfaces só entram no SD-WAN se não estiverem em uso: remova antes rotas estáticas e políticas que as referenciam.',
        'Depois de aplicar, use a zona SD-WAN (no lugar de wan1/wan2) nas políticas de saída para a internet.',
      ];
      if (list(v, 'servers').length > 2) notes.push('O health check aceita até 2 servidores; os excedentes foram ignorados.');
      if (members.some((m) => !m.gw)) notes.push('Links sem gateway usam o gateway aprendido via DHCP/PPPoE.');
      return { script: cli.toString(), notes };
    },
  },
];
