/**
 * Ambient type declarations for `@liamcottle/meshcore.js`, which ships as plain
 * ESM JavaScript with no types. Only the surface consumed by this wrapper is
 * declared. Shapes mirror the raw values produced by `src/connection/*.js` and
 * `src/constants.js`; the wrapper normalizes them before exposing to callers.
 *
 * This file is copied to `dist/` at build time and referenced from the emitted
 * `dist/index.d.ts` (via a `/// <reference>` in `src/index.ts`) so downstream
 * consumers get types for the re-exported raw classes too — without it they hit
 * `TS7016: Could not find a declaration file for module '@liamcottle/meshcore.js'`.
 */
declare module "@liamcottle/meshcore.js" {
  // --- Raw payload shapes (as parsed by the library) ---

  export interface RawContact {
    publicKey: Uint8Array;
    type: number;
    flags: number;
    outPathLen: number;
    outPath: Uint8Array;
    advName: string;
    lastAdvert: number;
    advLat: number;
    advLon: number;
    lastMod: number;
  }

  export interface RawSelfInfo {
    type: number;
    txPower: number;
    maxTxPower: number;
    publicKey: Uint8Array;
    advLat: number;
    advLon: number;
    reserved: Uint8Array;
    manualAddContacts: number;
    radioFreq: number;
    radioBw: number;
    radioSf: number;
    radioCr: number;
    name: string;
  }

  export interface RawChannel {
    channelIdx: number;
    name: string;
    secret: Uint8Array;
  }

  export interface RawContactMessage {
    pubKeyPrefix: Uint8Array;
    pathLen: number;
    txtType: number;
    senderTimestamp: number;
    text: string;
  }

  export interface RawChannelMessage {
    channelIdx: number;
    pathLen: number;
    txtType: number;
    senderTimestamp: number;
    text: string;
  }

  export interface RawChannelData {
    snr: number;
    reserved1: number;
    reserved2: number;
    channelIdx: number;
    pathLen: number;
    dataType: number;
    dataLen: number;
    data: Uint8Array;
  }

  export type RawWaitingMessage =
    | { contactMessage: RawContactMessage }
    | { channelMessage: RawChannelMessage }
    | { channelData: RawChannelData };

  export interface RawSent {
    result: number;
    expectedAckCrc: number;
    estTimeout: number;
  }

  export interface RawSendConfirmed {
    ackCode: number;
    roundTrip: number;
  }

  export interface RawDeviceInfo {
    firmwareVer: number;
    reserved: Uint8Array;
    firmware_build_date: string;
    manufacturerModel: string;
  }

  export interface RawBatteryVoltage {
    batteryMilliVolts: number;
  }

  export interface RawCurrTime {
    epochSecs: number;
  }

  export interface RawLoginSuccess {
    reserved: number;
    pubKeyPrefix: Uint8Array;
  }

  export interface RawAdvert {
    publicKey: Uint8Array;
  }

  export interface RawNewAdvert {
    publicKey: Uint8Array;
    type: number;
    flags: number;
    outPathLen: number;
    outPath: Uint8Array;
    advName: string;
    lastAdvert: number;
    advLat: number;
    advLon: number;
    lastMod: number;
  }

  export interface RawRawData {
    lastSnr: number;
    lastRssi: number;
    reserved: number;
    payload: Uint8Array;
  }

  export interface RawStatusResponsePush {
    reserved: number;
    pubKeyPrefix: Uint8Array;
    statusData: Uint8Array;
  }

  export interface RawLogRxData {
    lastSnr: number;
    lastRssi: number;
    raw: Uint8Array;
  }

  export interface RawTelemetryResponse {
    reserved: number;
    pubKeyPrefix: Uint8Array;
    lppSensorData: Uint8Array;
  }

  export interface RawBinaryResponse {
    reserved: number;
    tag: number;
    responseData: Uint8Array;
  }

  export interface RawTraceData {
    reserved: number;
    pathLen: number;
    flags: number;
    tag: number;
    authCode: number;
    pathHashes: Uint8Array;
    pathSnrs: Uint8Array;
    lastSnr: number;
  }

  export interface RawRepeaterStats {
    batt_milli_volts: number;
    curr_tx_queue_len: number;
    noise_floor: number;
    last_rssi: number;
    n_packets_recv: number;
    n_packets_sent: number;
    total_air_time_secs: number;
    total_up_time_secs: number;
    n_sent_flood: number;
    n_sent_direct: number;
    n_recv_flood: number;
    n_recv_direct: number;
    err_events: number;
    last_snr: number;
    n_direct_dups: number;
    n_flood_dups: number;
  }

  export interface RawCoreStatsData {
    batteryMilliVolts: number;
    uptimeSecs: number;
    queueLen: number;
  }

  export interface RawRadioStatsData {
    noiseFloor: number;
    lastRssi: number;
    lastSnr: number;
    txAirSecs: number;
    rxAirSecs: number;
  }

  export interface RawPacketStatsData {
    recv: number;
    sent: number;
    nSentFlood: number;
    nSentDirect: number;
    nRecvFlood: number;
    nRecvDirect: number;
    nRecvErrors: number | null;
  }

  export interface RawStats {
    type: number;
    raw: Uint8Array;
    data: RawCoreStatsData | RawRadioStatsData | RawPacketStatsData | Record<string, never>;
  }

  export interface RawNeighbour {
    publicKeyPrefix: Uint8Array;
    heardSecondsAgo: number;
    snr: number;
  }

  export interface RawNeighboursResult {
    totalNeighboursCount: number;
    neighbours: RawNeighbour[];
  }

  // --- The base connection class ---

  export class Connection {
    on(event: string | number, listener: (...args: any[]) => void): void;
    off(event: string | number, listener: (...args: any[]) => void): void;
    once(event: string | number, listener: (...args: any[]) => void): void;
    emit(event: string | number, ...args: any[]): void;

    connect(): Promise<void>;
    close(): Promise<void>;

    getSelfInfo(timeoutMillis?: number | null): Promise<RawSelfInfo>;

    getContacts(): Promise<RawContact[]>;
    findContactByName(name: string): Promise<RawContact | undefined>;
    findContactByPublicKeyPrefix(prefix: Uint8Array): Promise<RawContact | undefined>;

    sendTextMessage(
      contactPublicKey: Uint8Array,
      text: string,
      type?: number,
    ): Promise<RawSent>;
    sendChannelTextMessage(channelIdx: number, text: string): Promise<void>;

    syncNextMessage(): Promise<RawWaitingMessage | null>;
    getWaitingMessages(): Promise<RawWaitingMessage[]>;

    getDeviceTime(): Promise<RawCurrTime>;
    setDeviceTime(epochSecs: number): Promise<void>;
    syncDeviceTime(): Promise<void>;

    importContact(advertPacketBytes: Uint8Array): Promise<void>;
    exportContact(pubKey?: Uint8Array | null): Promise<{ advertPacketBytes: Uint8Array }>;
    shareContact(pubKey: Uint8Array): Promise<void>;
    removeContact(pubKey: Uint8Array): Promise<void>;
    addOrUpdateContact(
      publicKey: Uint8Array,
      type: number,
      flags: number,
      outPathLen: number,
      outPath: Uint8Array,
      advName: string,
      lastAdvert: number,
      advLat: number,
      advLon: number,
    ): Promise<void>;
    resetPath(pubKey: Uint8Array): Promise<void>;

    reboot(): Promise<void>;
    getBatteryVoltage(): Promise<RawBatteryVoltage>;
    deviceQuery(appTargetVer: number): Promise<RawDeviceInfo>;
    exportPrivateKey(): Promise<{ privateKey: Uint8Array }>;
    importPrivateKey(privateKey: Uint8Array): Promise<void>;

    sendAdvert(type: number): Promise<void>;
    sendFloodAdvert(): Promise<void>;
    sendZeroHopAdvert(): Promise<void>;
    setAdvertName(name: string): Promise<void>;
    setAdvertLatLong(latitude: number, longitude: number): Promise<void>;
    setTxPower(txPower: number): Promise<void>;
    setRadioParams(
      radioFreq: number,
      radioBw: number,
      radioSf: number,
      radioCr: number,
    ): Promise<void>;

    login(
      contactPublicKey: Uint8Array,
      password: string,
      extraTimeoutMillis?: number,
    ): Promise<RawLoginSuccess>;
    getStatus(
      contactPublicKey: Uint8Array,
      extraTimeoutMillis?: number,
    ): Promise<RawRepeaterStats>;
    getTelemetry(
      contactPublicKey: Uint8Array,
      extraTimeoutMillis?: number,
    ): Promise<RawTelemetryResponse>;
    sendBinaryRequest(
      contactPublicKey: Uint8Array,
      requestCodeAndParams: Uint8Array,
      extraTimeoutMillis?: number,
    ): Promise<Uint8Array>;
    getNeighbours(
      publicKey: Uint8Array,
      count?: number,
      offset?: number,
      orderBy?: number,
      pubKeyPrefixLength?: number,
    ): Promise<RawNeighboursResult>;

    getChannel(channelIdx: number): Promise<RawChannel>;
    getChannels(): Promise<RawChannel[]>;
    setChannel(channelIdx: number, name: string, secret: Uint8Array): Promise<void>;
    deleteChannel(channelIdx: number): Promise<void>;
    findChannelByName(name: string): Promise<RawChannel | undefined>;
    findChannelBySecret(secret: Uint8Array): Promise<RawChannel | undefined>;

    getStats(statsType: number): Promise<RawStats>;
    getStatsCore(): Promise<RawStats>;
    getStatsRadio(): Promise<RawStats>;
    getStatsPackets(): Promise<RawStats>;

    sign(data: Uint8Array): Promise<Uint8Array>;
    tracePath(path: Uint8Array, extraTimeoutMillis?: number): Promise<RawTraceData>;

    setOtherParams(manualAddContacts: boolean): Promise<void>;
    setAutoAddContacts(): Promise<void>;
    setManualAddContacts(): Promise<void>;

    setFloodScope(transportKey: Uint8Array): Promise<unknown>;
    clearFloodScope(): Promise<unknown>;
  }

  export class TCPConnection extends Connection {
    constructor(host: string, port: number);
  }

  export class NodeJSSerialConnection extends Connection {
    constructor(path: string);
  }

  export class SerialConnection extends Connection {}
  export class WebBleConnection extends Connection {}
  export class WebSerialConnection extends Connection {}

  export interface MeshCoreConstants {
    SupportedCompanionProtocolVersion: number;
    SerialFrameTypes: { Incoming: number; Outgoing: number };
    Ble: {
      ServiceUuid: string;
      CharacteristicUuidRx: string;
      CharacteristicUuidTx: string;
    };
    DataTypes: { Dev: number };
    StatsTypes: { Core: number; Radio: number; Packets: number };
    CommandCodes: Record<string, number>;
    ResponseCodes: {
      Ok: number;
      Err: number;
      ContactsStart: number;
      Contact: number;
      EndOfContacts: number;
      SelfInfo: number;
      Sent: number;
      ContactMsgRecv: number;
      ChannelMsgRecv: number;
      CurrTime: number;
      NoMoreMessages: number;
      ExportContact: number;
      BatteryVoltage: number;
      DeviceInfo: number;
      PrivateKey: number;
      Disabled: number;
      ChannelInfo: number;
      SignStart: number;
      Signature: number;
      Stats: number;
      ChannelDataRecv: number;
    };
    PushCodes: {
      Advert: number;
      PathUpdated: number;
      SendConfirmed: number;
      MsgWaiting: number;
      RawData: number;
      LoginSuccess: number;
      LoginFail: number;
      StatusResponse: number;
      LogRxData: number;
      TraceData: number;
      NewAdvert: number;
      TelemetryResponse: number;
      BinaryResponse: number;
    };
    ErrorCodes: Record<string, number>;
    AdvType: { None: number; Chat: number; Repeater: number; Room: number };
    SelfAdvertTypes: { ZeroHop: number; Flood: number };
    TxtTypes: { Plain: number; CliData: number; SignedPlain: number };
    BinaryRequestTypes: Record<string, number>;
  }

  export const Constants: MeshCoreConstants;

  export const BufferUtils: {
    areBuffersEqual(a: Uint8Array, b: Uint8Array): boolean;
    [key: string]: unknown;
  };
  export const Packet: unknown;
  export const Advert: unknown;
  export const CayenneLpp: unknown;
  export const MeshCorePath: unknown;
  export const TransportKeyUtil: {
    getHashtagRegionKey(hashtag: string): Promise<Uint8Array>;
    [key: string]: unknown;
  };
}
