import { LocalPair } from '../local-pair'
import { BaseNode } from '../base-node'

/**
 * Two paired loopback connections with events tracking
 * to be used in Logux tests.
 *
 * ```js
 * import { TestPair } from '@logux/core'
 * it('tracks events', async () => {
 *   const pair = new TestPair()
 *   const client = new ClientNode(pair.right)
 *   await pair.left.connect()
 *   expect(pair.leftEvents).toEqual('connect')
 *   await pair.left.send(msg)
 *   expect(pair.leftSent).toEqual([msg])
 * })
 * ```
 */
export class TestPair extends LocalPair {
  /**
   * Node instance used in this test, connected with `left`.
   *
   * ```js
   * function createTest () {
   *   test = new TestPair()
   *   test.leftNode = ClientNode('client', log, test.left)
   *   return test
   * }
   * ```
   */
  leftNode: BaseNode

  /**
   * Node instance used in this test, connected with `right`.
   *
   * ```js
   * function createTest () {
   *   test = new TestPair()
   *   test.rightNode = ServerNode('client', log, test.right)
   *   return test
   * }
   * ```
   */
  rightNode: BaseNode

  /**
   * Sent messages from `left` connection.
   *
   * ```js
   * await pair.left.send(msg)
   * pair.leftSent //=> [msg]
   * ```
   */
  leftSent: string[][]

  /**
   * Sent messages from `right` connection.
   *
   * ```js
   * await pair.right.send(msg)
   * pair.rightSent //=> [msg]
   * ```
   */
  rightSent: string[][]

  /**
   * Emitted events from `left` connection.
   *
   * ```js
   * await pair.left.connect()
   * pair.leftEvents //=> [['connect']]
   * ```
   */
  leftEvents: string[][]

  /**
   * Emitted events from `right` connection.
   *
   * ```js
   * await pair.right.connect()
   * pair.rightEvents //=> [['connect']]
   * ```
   */
  rightEvents: string[][]

  /**
   * Clear all connections events and messages to test only last events.
   *
   * ```js
   * await client.connection.connect()
   * pair.clear() // Remove all connecting messages
   * await client.log.add({ type: 'a' })
   * expect(pair.leftSent).toEqual([
   *   ['sync', …]
   * ])
   * ```
   */
  clear (): void

  /**
   * Return Promise until next event.
   *
   * ```js
   * pair.left.send(['test'])
   * await pair.wait('left')
   * pair.leftSend //=> [['test']]
   * ```
   *
   * @param receiver Wait for specific receiver event.
   * @returns Promise until next event.
   */
  wait (receiver: 'left' | 'right'): Promise<void>
}
