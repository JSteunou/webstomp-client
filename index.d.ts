// Type definitions for webstomp-client v1.0.x
// Project: https://github.com/JSteunou/webstomp-client
// Definitions by: Jimi Charalampidis <https://github.com/JimiC>

export function client(url: string, options?: Options): Client;

export function over(socketType: any, options?: Options): Client;

export class Client {

  connect(headers: ConnectionHeaders, connectCallback: (frame?: Frame) => any, errorCallback?: (error: string) => any): void;
  connect(login: string, passcode: string, connectCallback: (frame?: Frame) => any, errorCallback?: (error: string) => any, host?: string): void;

  disconnect(disconnectCallback: () => any, headers?: DisconnectHeaders): void;

  send(destination: string, body?: string, headers?: ExtendedHeaders): void;

  subscribe(destination: string, callback?: (message: Message) => any, headers?: SubscribeHeaders): Subscription;

  unsubscribe(id: string, header?: UnsubscribeHeaders): void;

  begin(transaction: string): void;

  commit(transaction: string): void;

  abort(transaction: string): void;

  ack(messageID: string, subscription: Subscription, headers?: AckHeaders): void;

  nack(messageID: string, subscription: Subscription, headers?: NackHeaders): void;
}

export class Frame {
  constructor(command: string, headers?: {}, body?: string);

  toString(): string;
  sizeOfUTF8(s: string): number;
  unmarshall(datas: any): any;
  marshall(command: string, headers?: {}, body?: string): any;
}

export const VERSIONS: {
  V1_0: string,
  V1_1: string,
  V1_2: string,
  // Versions of STOMP specifications supported
  supportedVersions: () => string,
  supportedProtocols: () => Array<string>
}

export interface Heartbeat {
  outgoing: number,
  incoming: number
}

export interface Subscription {
  id: string;
  unsubscribe: () => void;
}

export interface Message {
  command: string;
  body: string;
  headers: ExtendedHeaders,
  ack(headers?: AckHeaders): any;
  nack(headers?: NackHeaders): any;
}

export interface Options extends ClientOptions {
  protocols: Array<string>;
}

export interface ClientOptions {
  binary: boolean;
  heartbeat: Heartbeat | boolean;
  debug: boolean;
}

export interface ConnectionHeaders {
  login: string;
  passcode: string;
  host?: string;
}

export interface DisconnectHeaders {
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
