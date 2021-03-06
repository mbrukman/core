import { Store } from '../log'

/**
 * Simple memory-based log store.
 *
 * It is good for tests, but not for server or client usage,
 * because it store all data in memory and will lose log on exit.
 *
 * ```
 * import { MemoryStore } from '@logux/core'
 *
 * var log = new Log({
 *   nodeId: 'server',
 *   store: new MemoryStore()
 * })
 * ```
 */
export class MemoryStore extends Store { }
