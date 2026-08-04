export interface IAddressPayload {
  name: string;
  ip: string;
  mask: string;
}

export interface IVpnS2SPayload {
  tunnelName: string;
  remoteGateway: string;
  preSharedKey: string;
  localSubnet: string;
  remoteSubnet: string;
  outgoingInterface: string;
}

export interface IInterfacePayload {
  name: string;
  ip: string;
  mask: string;
  alias?: string;
  allowAccess?: string; // ex: "ping https ssh"
}