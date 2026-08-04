// src/services/fortigateGenerator.ts

// ==========================================
// 1. Interfaces / Tipagens de Payload
// ==========================================

export interface AddressPayload {
  name: string;
  ip: string;
  mask: string;
}

export interface AddressGroupPayload {
  name: string;
  members: string[];
}

export interface MacReservationPayload {
  dhcpId: string;
  ip: string;
  mac: string;
  description: string;
}

export interface ZonePayload {
  zoneName: string;
  interfaces: string[];
}

export interface InterfacePayload {
  name: string;
  vdom?: string;
  ip: string;
  mask: string;
  allowaccess: string[];
  alias?: string;
  type?: 'physical' | 'vlan' | 'tunnel';
  parentInterface?: string; // Usado se for VLAN
  vlanId?: number;          // Usado se for VLAN
}

export interface VpnSiteToSitePayload {
  name: string;
  interfaceName: string;
  remoteGw: string;
  psk: string;
  localSubnet: string;   // ex: 192.168.1.0 255.255.255.0
  remoteSubnet: string;  // ex: 10.0.0.0 255.255.255.0
}

export interface FortiClientPayload {
  name: string;
  interfaceName: string;
  psk: string;
  userGroup: string;
  ipRangeStart: string;
  ipRangeEnd: string;
}


// ==========================================
// 2. Motor de Geração CLI (FortiOS)
// ==========================================

export class FortiGateCLI {

  // --- OBJETOS DE FIREWALL ---

  // CORREÇÃO: Removidos os parâmetros avulsos "ip" e "mask"
  static createAddress(data: AddressPayload): string {
    return `config firewall address
    edit "${data.name}"
        set type ipmask
        set subnet ${data.ip} ${data.mask}
    next
end`;
  }

  static createAddressGroup(data: AddressGroupPayload): string {
    const membersList = data.members.map(m => `"${m}"`).join(' ');
    return `config firewall addrgrp
    edit "${data.name}"
        set member ${membersList}
    next
end`;
  }

  // --- REDE (NETWORK) ---

  static createInterface(data: InterfacePayload): string {
    const vdom = data.vdom || 'root';
    const accessList = data.allowaccess.join(' ');
    
    let config = `config system interface\n    edit "${data.name}"\n        set vdom "${vdom}"\n        set ip ${data.ip} ${data.mask}\n        set allowaccess ${accessList}`;

    if (data.type === 'vlan' && data.parentInterface && data.vlanId) {
      config += `\n        set type vlan\n        set interface "${data.parentInterface}"\n        set vlanid ${data.vlanId}`;
    }
    if (data.alias) {
      config += `\n        set alias "${data.alias}"`;
    }
    
    config += `\n    next\nend`;
    return config;
  }

  // CORREÇÃO: Removido o parâmetro avulso "interfaces"
  static createZone(data: ZonePayload): string {
    const intfString = data.interfaces.map(i => `"${i}"`).join(' ');
    return `config system zone
    edit "${data.zoneName}"
        set interface ${intfString}
    next
end`;
  }

  // CORREÇÃO: Removidos os parâmetros avulsos "ip", "mac" e "desc"
  static createMacReservation(data: MacReservationPayload): string {
    return `config system dhcp server
    edit ${data.dhcpId}
        config reserved-address
            edit 0
                set ip ${data.ip}
                set mac ${data.mac}
                set description "${data.description}"
            next
        end
    next
end`;
  }

  // --- VPN IPSEC ---

  static createVpnSiteToSite(data: VpnSiteToSitePayload): string {
    return `config vpn ipsec phase1-interface
    edit "${data.name}"
        set interface "${data.interfaceName}"
        set peertype any
        set net-device disable
        set proposal aes256-sha256
        set remote-gw ${data.remoteGw}
        set psksecret ${data.psk}
    next
end
config vpn ipsec phase2-interface
    edit "${data.name}_p2"
        set phase1name "${data.name}"
        set proposal aes256-sha256
        set src-subnet ${data.localSubnet}
        set dst-subnet ${data.remoteSubnet}
    next
end`;
  }

  static createFortiClientDialup(data: FortiClientPayload): string {
    return `config vpn ipsec phase1-interface
    edit "${data.name}"
        set type dynamic
        set interface "${data.interfaceName}"
        set mode aggressive
        set peertype any
        set net-device disable
        set proposal aes256-sha256
        set dpd on-idle
        set xauthtype auto
        set authusrgrp "${data.userGroup}"
        set psksecret ${data.psk}
    next
end
config vpn ipsec phase2-interface
    edit "${data.name}_p2"
        set phase1name "${data.name}"
        set proposal aes256-sha256
    next
end
config firewall address
    edit "${data.name}_Pool"
        set type iprange
        set start-ip ${data.ipRangeStart}
        set end-ip ${data.ipRangeEnd}
    next
end`;
  }
}