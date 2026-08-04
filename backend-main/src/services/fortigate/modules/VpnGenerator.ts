import type { IVpnS2SPayload } from '../types.ts';

export class VpnGenerator {
  public static generateSiteToSite(payload: IVpnS2SPayload): string {
    return `
config vpn ipsec phase1-interface
    edit "${payload.tunnelName}"
        set interface "${payload.outgoingInterface}"
        set peertype any
        set net-device disable
        set proposal aes256-sha256
        set remote-gw ${payload.remoteGateway}
        set psksecret ${payload.preSharedKey}
    next
end
config vpn ipsec phase2-interface
    edit "${payload.tunnelName}-P2"
        set phase1name "${payload.tunnelName}"
        set proposal aes256-sha256
        set src-subnet ${payload.localSubnet}
        set dst-subnet ${payload.remoteSubnet}
    next
end
`.trim();
  }
}