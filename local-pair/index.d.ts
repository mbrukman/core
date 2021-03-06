import { Connection } from '../base-node'

/**
 * Two paired loopback connections.
 *
 * ```js
 * import { LocalPair, ClientNode, ServerNode } from '@logux/core'
 * const pair = new LocalPair()
 * const client = new ClientNode('client, log1, pair.left)
 * const server = new ServerNode('server, log2, pair.right)
 * ```
 */
export class LocalPair {
  /**
   * @param delay Delay for connection and send events. Default is `1`.
   */
  constructor (delay?: number)

  /**
   * Delay for connection and send events to emulate real connection latency.
   */
  delay: number

  /**
   * First connection. Will be connected to `right` one after `connect()`.
   *
   * ```js
   * new ClientNode('client, log1, pair.left)
   * ```
   */
  left: Connection

  /**
   * Second connection. Will be connected to `right` one after `connect()`.
   *
   * ```js
   * new ServerNode('server, log2, pair.right)
   * ```
   */
  right: Connection
}
