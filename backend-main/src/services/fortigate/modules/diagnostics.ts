import { ValidationError, type FieldDef, type GenerateResult, type TemplateDef } from '../types.ts';
import { bool, str } from '../validate.ts';

const CATEGORY = 'Diagnóstico';

const versionField: FieldDef = {
  name: 'version', label: 'FortiOS', type: 'select', default: '7.4',
  options: [{ value: '7.2', label: '7.0 / 7.2' }, { value: '7.4', label: '7.4 ou superior' }],
};

const STOP_DEBUG = ['diagnose debug disable', 'diagnose debug reset'];

// Diagnóstico é executado em etapas: cada seção vira um bloco copiável no frontend.
const result = (sections: Array<{ title: string; lines: string[] }>, notes: string[] = []): GenerateResult => {
  const parts = sections.filter((s) => s.lines.length).map((s) => ({ title: s.title, script: s.lines.join('\n') }));
  return { script: parts.map((p) => p.script).join('\n\n'), sections: parts, notes };
};

const PROTO_NUM: Record<string, string> = { tcp: '6', udp: '17', icmp: '1' };

const protoOptions = [
  { value: '', label: 'Qualquer' },
  { value: 'tcp', label: 'TCP' },
  { value: 'udp', label: 'UDP' },
  { value: 'icmp', label: 'ICMP' },
];

export const diagnosticTemplates: TemplateDef[] = [
  {
    id: 'diag-vpn',
    category: CATEGORY,
    title: 'VPN IPsec',
    description: 'Status do túnel e debug de IKE filtrado pelo peer.',
    fields: [
      versionField,
      { name: 'tunnel', label: 'Nome da phase1', type: 'text', required: true, format: 'name', placeholder: 'VPN-FILIAL01' },
      { name: 'peer', label: 'IP público do peer (filtro do debug)', type: 'text', required: true, format: 'ipv4' },
      { name: 'reset', label: 'Incluir comandos para forçar renegociação', type: 'checkbox', default: false },
    ],
    build(v) {
      const tunnel = str(v, 'tunnel');
      const peer = str(v, 'peer');
      const modern = str(v, 'version') === '7.4';
      const filter = modern ? 'diagnose vpn ike log filter' : 'diagnose vpn ike log-filter';
      return result(
        [
          {
            title: 'Status',
            lines: [
              'get vpn ipsec tunnel summary',
              `diagnose vpn ike gateway list name ${tunnel}`,
              `diagnose vpn tunnel list name ${tunnel}`,
            ],
          },
          {
            title: 'Iniciar debug de IKE',
            lines: [
              'diagnose debug reset',
              `${filter} clear`,
              `${filter} ${modern ? 'rem-addr4' : 'dst-addr4'} ${peer}`,
              'diagnose debug application ike -1',
              'diagnose debug console timestamp enable',
              'diagnose debug enable',
            ],
          },
          { title: 'Parar debug', lines: STOP_DEBUG },
          {
            title: 'Forçar renegociação (derruba o túnel)',
            lines: bool(v, 'reset') ? [`diagnose vpn ike gateway clear name ${tunnel}`, `diagnose vpn tunnel up ${tunnel}-P2 ${tunnel}`] : [],
          },
        ],
        [
          'No debug, procure "no SA proposal chosen" (proposta/DH diferente), "peer SA proposal not match local policy" (seletores diferentes) e "authentication failed" (PSK ou ID).',
          ...(bool(v, 'reset') ? ['Ajuste o nome da phase2 no "tunnel up" se não seguir o padrão <túnel>-P2.'] : []),
        ],
      );
    },
  },

  {
    id: 'diag-flow',
    category: CATEGORY,
    title: 'Debug flow',
    description: 'Mostra a decisão do firewall pacote a pacote: rota, política, NAT e descarte.',
    fields: [
      { name: 'saddr', label: 'IP de origem', type: 'text', format: 'ipv4' },
      { name: 'daddr', label: 'IP de destino', type: 'text', format: 'ipv4' },
      { name: 'dport', label: 'Porta de destino', type: 'number', min: 1, max: 65535 },
      { name: 'proto', label: 'Protocolo', type: 'select', default: '', options: protoOptions },
      { name: 'count', label: 'Quantidade de pacotes', type: 'number', default: '100', min: 1, max: 10000 },
    ],
    build(v) {
      if (!str(v, 'saddr') && !str(v, 'daddr') && !str(v, 'dport')) {
        throw new ValidationError({ saddr: 'Informe ao menos origem, destino ou porta para não sobrecarregar o firewall' });
      }
      const filters = [
        str(v, 'saddr') && `diagnose debug flow filter saddr ${str(v, 'saddr')}`,
        str(v, 'daddr') && `diagnose debug flow filter daddr ${str(v, 'daddr')}`,
        str(v, 'dport') && `diagnose debug flow filter dport ${str(v, 'dport')}`,
        str(v, 'proto') && `diagnose debug flow filter proto ${PROTO_NUM[str(v, 'proto')]}`,
      ].filter((line): line is string => !!line);
      return result(
        [
          {
            title: 'Iniciar',
            lines: [
              'diagnose debug reset',
              'diagnose debug flow filter clear',
              ...filters,
              'diagnose debug flow show function-name enable',
              'diagnose debug flow show iprope enable',
              'diagnose debug console timestamp enable',
              `diagnose debug flow trace start ${str(v, 'count')}`,
              'diagnose debug enable',
            ],
          },
          { title: 'Parar', lines: ['diagnose debug flow trace stop', 'diagnose debug flow filter clear', ...STOP_DEBUG] },
        ],
        ['Mensagens úteis: "Denied by forward policy check (policy 0)" = nenhuma política casou; "reverse path check fail" = rota de retorno por outra interface.'],
      );
    },
  },

  {
    id: 'diag-sniffer',
    category: CATEGORY,
    title: 'Sniffer de pacotes',
    description: 'Captura no console com filtro estilo tcpdump.',
    fields: [
      { name: 'interface', label: 'Interface', type: 'text', format: 'name', default: 'any' },
      { name: 'host1', label: 'Host', type: 'text', format: 'ipv4' },
      { name: 'host2', label: 'Segundo host (conversa entre os dois)', type: 'text', format: 'ipv4' },
      { name: 'port', label: 'Porta', type: 'number', min: 1, max: 65535 },
      { name: 'proto', label: 'Protocolo', type: 'select', default: '', options: protoOptions },
      {
        name: 'verbosity', label: 'Detalhe', type: 'select', default: '4',
        options: [
          { value: '4', label: '4 – cabeçalhos com interface' },
          { value: '6', label: '6 – pacote completo (para converter em pcap)' },
        ],
      },
      { name: 'count', label: 'Quantidade de pacotes', type: 'number', default: '100', min: 1, max: 100000 },
    ],
    build(v) {
      const parts: string[] = [];
      const h1 = str(v, 'host1');
      const h2 = str(v, 'host2');
      if (h1 && h2) parts.push(`host ${h1} and host ${h2}`);
      else if (h1 || h2) parts.push(`host ${h1 || h2}`);
      if (str(v, 'proto')) parts.push(str(v, 'proto'));
      if (str(v, 'port')) parts.push(`port ${str(v, 'port')}`);
      const filter = parts.length ? parts.join(' and ') : 'none';
      const notes = ['Ctrl+C interrompe a captura antes de atingir a quantidade.'];
      if (filter === 'none') notes.push('Captura sem filtro: em produção prefira filtrar por host ou porta.');
      if (str(v, 'verbosity') === '6') notes.push('Salve a saída do terminal e converta com fgt2eth.pl para abrir no Wireshark.');
      return result(
        [{ title: 'Captura', lines: [`diagnose sniffer packet ${str(v, 'interface') || 'any'} '${filter}' ${str(v, 'verbosity')} ${str(v, 'count')} l`] }],
        notes,
      );
    },
  },

  {
    id: 'diag-sdwan',
    category: CATEGORY,
    title: 'SD-WAN',
    description: 'Estado dos membros, SLA, regras e rotas.',
    fields: [
      versionField,
      { name: 'interface', label: 'Interface para histórico de SLA (opcional)', type: 'text', format: 'name', placeholder: 'wan1' },
    ],
    build(v) {
      const modern = str(v, 'version') === '7.4';
      return result([
        {
          title: 'Estado',
          lines: [
            'diagnose sys sdwan member',
            'diagnose sys sdwan health-check',
            modern ? 'diagnose sys sdwan service4' : 'diagnose sys sdwan service',
            ...(str(v, 'interface') ? [`diagnose sys sdwan intf-sla-log ${str(v, 'interface')}`] : []),
            'get router info routing-table all',
          ],
        },
      ]);
    },
  },

  {
    id: 'diag-health',
    category: CATEGORY,
    title: 'Saúde do equipamento / HA',
    description: 'CPU, memória, sessões, conserve mode, erros de interface e cluster HA.',
    fields: [
      { name: 'interface', label: 'Porta para checar erros (opcional)', type: 'text', format: 'name', placeholder: 'wan1' },
      { name: 'ha', label: 'Incluir comandos de HA', type: 'checkbox', default: false },
    ],
    build(v) {
      return result([
        {
          title: 'Sistema',
          lines: [
            'get system status',
            'get system performance status',
            'diagnose sys top 2 20 1',
            'diagnose hardware sysinfo conserve',
            'diagnose sys session stat',
          ],
        },
        {
          title: 'Interface',
          lines: str(v, 'interface') ? [`diagnose hardware deviceinfo nic ${str(v, 'interface')}`] : [],
        },
        {
          title: 'HA',
          lines: bool(v, 'ha') ? ['get system ha status', 'diagnose sys ha checksum cluster', 'diagnose sys ha history read'] : [],
        },
      ]);
    },
  },
];
