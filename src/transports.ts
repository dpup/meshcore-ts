/**
 * Typed re-exports of the Node transports and a few useful utilities from
 * meshcore.js. Browser transports (BLE / WebSerial) are intentionally not
 * re-exported so bundlers never pull in the `serialport` dependency.
 *
 * Most users should prefer {@link MeshCoreClient.tcp} / {@link MeshCoreClient.serial}.
 */
export {
  Connection,
  TCPConnection,
  NodeJSSerialConnection,
  Constants,
  BufferUtils,
  TransportKeyUtil,
} from "@liamcottle/meshcore.js";
