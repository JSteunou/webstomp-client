// Type definitions for webstomp-client v1.0.x
// Project: https://github.com/JSteunou/webstomp-client
// Definitions by: Jimi Charalampidis <https://github.com/JimiC>
//                 Rodolfo Aguirre <https://github.com/roddolf>

export function client(url: string, options?: Options): Client;

export function over(socketType: any, options?: Options): Client;

export class Client {
  connected: boolean;
  isBinary: boolean;
  partialData: string;
  subscriptions: SubscriptionsMap;
  ws: any;

  connect(headers: ConnectionHeaders, connectCallback: (frame?: Frame) => any, errorCallback?: (error: CloseEvent | Frame) => any): void;
  connect(login: string, passcode: string, connectCallback: (frame?: Frame) => any, errorCallback?: (error: CloseEvent | Frame) => any, host?: string): void;

  disconnect(disconnectCallback?: () => any, headers?: DisconnectHeaders): void;

  send(destination: string, body?: string, headers?: ExtendedHeaders): void;

  subscribe(destination: string, callback?: (message: Message) => any, headers?: SubscribeHeaders): Subscription;

  unsubscribe(id: string, header?: UnsubscribeHeaders): void;

  begin(transaction: string): void;

  commit(transaction: string): void;

  abort(transaction: string): void;

  ack(messageID: string, subscription: Subscription, headers?: AckHeaders): void;

  nack(messageID: string, subscription: Subscription, headers?: NackHeaders): void;

  debug(...args: any[]): void;

  onreceipt?(frame: Frame): void;
}

export class Frame {
  command: string;
  body: string;
  headers: Headers;

  constructor(command: string, headers?: Headers, body?: string);
  toString(): string;

  static unmarshallSingle(data: string): Frame;
  static unmarshall(datas: string): { frames: Frame[], partial?: string };
  static marshall(command: string, headers?: Headers, body?: string): string;
}

export const VERSIONS: {
  V1_0: string,
  V1_1: string,
  V1_2: string,
  // Versions of STOMP specifications supported
  supportedVersions: () => string,
  supportedProtocols: () => string[]
}

export interface Heartbeat {
  outgoing: number,
  incoming: number
}

export interface Subscription {
  id: string;
  unsubscribe: () => void;
}

export interface SubscriptionsMap {
  [id: string]: (message: Message) => any;
}

export interface Message extends Frame {
  headers: ExtendedHeaders;
  ack(headers?: AckHeaders): any;
  nack(headers?: NackHeaders): any;
}

export interface Options extends ClientOptions {
  protocols?: string[];
}

export interface ClientOptions {
  binary?: boolean;
  heartbeat?: Heartbeat | boolean;
  debug?: boolean;
}

export interface Headers {
  [key: string]: string | undefined;
}

export interface ConnectionHeaders extends Headers {
  login?: string;
  passcode?: string;
  host?: string;
}

export interface DisconnectHeaders extends Headers {
  'receipt'?: string;
}

export interface StandardHeaders extends DisconnectHeaders {
  'content-length'?: string;
  'content-type'?: string;
}

export interface ExtendedHeaders extends StandardHeaders {
  'amqp-message-id'?: string,
  'app-id'?: string,
  'content-encoding'?: string,
  'correlation-id'?: string,
  custom?: string,
  destination?: string,
  'message-id'?: string,
  persistent?: string,
  redelivered?: string,
  'reply-to'?: string,
  subscription?: string,
  timestamp?: string,
  type?: string,
}

export interface UnsubscribeHeaders extends StandardHeaders {
  id?: string,
}

export interface SubscribeHeaders extends UnsubscribeHeaders {
  ack?: string
}

export interface AckHeaders extends UnsubscribeHeaders {
  transaction?: string
}

export interface NackHeaders extends AckHeaders {
}

declare const webstomp: {
    Frame: Frame,
    VERSIONS: typeof VERSIONS,
    client: typeof client,
    over: typeof over,
}
export default webstomp
