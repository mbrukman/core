import { delay } from 'nanodelay'
import { restoreAll, spyOn } from 'nanospy'
import { deepStrictEqual, equal, notEqual, ok } from 'node:assert'
import { afterEach, beforeEach, test } from 'node:test'

import { type Message, Reconnect, TestPair } from '../index.js'

let listeners: { [key: string]: () => void } = {}
const listenerMethods = {
  addEventListener(name: string, callback: () => void): void {
    listeners[name] = callback
  },
  removeEventListener(name: string, callback: () => void): void {
    if (listeners[name] === callback) {
      delete listeners[name]
    }
  }
}

function setHidden(value: boolean): void {
  // @ts-expect-error
  global.document.hidden = value
  listeners.visibilitychange()
}

function setOnLine(value: boolean, event: 'online' | 'resume'): void {
  // @ts-expect-error
  global.navigator.onLine = value
  listeners[event]()
}

function privateMethods(obj: object): any {
  return obj
}

beforeEach(() => {
  listeners = {}
  // @ts-expect-error
  global.window = {
    ...listenerMethods
  }
  // @ts-expect-error
  global.document = {
    hidden: false,
    ...listenerMethods
  }
  Object.defineProperty(global, 'navigator', {
    configurable: true,
    value: {
      onLine: true
    }
  })
})

afterEach(() => {
  restoreAll()
})

test('saves connection and options', () => {
  let pair = new TestPair()
  let recon = new Reconnect(pair.left, { attempts: 1 })
  equal(recon.connection, pair.left)
  equal(recon.options.attempts, 1)
})

test('uses default options', () => {
  let pair = new TestPair()
  let recon = new Reconnect(pair.left)
  equal(typeof recon.options.minDelay, 'number')
})

test('enables reconnecting on connect', () => {
  let pair = new TestPair()
  let recon = new Reconnect(pair.left)
  equal(recon.reconnecting, false)

  recon.connect()
  equal(recon.reconnecting, true)
})

test('enables reconnecting if connection was already connected', async () => {
  let pair = new TestPair()
  await pair.left.connect()
  let recon = new Reconnect(pair.left)
  equal(recon.reconnecting, true)
})

test('disables reconnecting on destroy and empty disconnect', async () => {
  let pair = new TestPair()
  let recon = new Reconnect(pair.left)

  await recon.connect()
  recon.disconnect('destroy')
  equal(recon.reconnecting, false)
  deepStrictEqual(pair.leftEvents, [['connect'], ['disconnect', 'destroy']])
  await recon.connect()
  recon.disconnect()
  equal(recon.reconnecting, false)
})

test('reconnects on timeout and error disconnect', async () => {
  let pair = new TestPair()
  await pair.left.connect()
  let recon = new Reconnect(pair.left)

  recon.disconnect('timeout')
  equal(recon.reconnecting, true)
  await pair.left.connect()

  recon.disconnect('error')
  equal(recon.reconnecting, true)
})

test('proxies connection methods', () => {
  let sent: Message[] = []
  let con = {
    async connect() {
      this.connected = true
    },
    connected: false,
    destroy() {},
    disconnect() {
      this.connected = false
    },
    emitter: {},
    on() {
      return () => {}
    },
    send(msg: Message) {
      sent.push(msg)
    }
  }
  let recon = new Reconnect(con)
  equal(recon.connected, false)
  equal(privateMethods(recon).emitter, con.emitter)

  recon.connect()
  equal(recon.connected, true)

  recon.send(['ping', 1])
  deepStrictEqual(sent, [['ping', 1]])

  recon.disconnect()
  equal(recon.connected, false)
})

test('proxies connection events', async () => {
  let pair = new TestPair()
  let recon = new Reconnect(pair.left)

  let received: Message[] = []
  let unbind = recon.on('message', msg => {
    received.push(msg)
  })

  await recon.connect()
  pair.right.send(['ping', 1])
  await pair.wait()
  pair.right.send(['ping', 2])
  await pair.wait()
  unbind()
  pair.right.send(['ping', 3])
  await pair.wait()
  deepStrictEqual(received, [
    ['ping', 1],
    ['ping', 2]
  ])
})

test('disables reconnection on protocol error', async () => {
  let pair = new TestPair()
  let recon = new Reconnect(pair.left)
  await recon.connect()
  pair.right.send(['error', 'wrong-protocol'])
  pair.right.disconnect()
  await pair.wait()
  equal(recon.reconnecting, false)
})

test('disables reconnection on authentication error', async () => {
  let pair = new TestPair()
  let recon = new Reconnect(pair.left)
  await recon.connect()
  pair.right.send(['error', 'wrong-credentials'])
  pair.right.disconnect()
  await pair.wait()
  equal(recon.reconnecting, false)
})

test('disables reconnection on subprotocol error', async () => {
  let pair = new TestPair()
  let recon = new Reconnect(pair.left)
  await recon.connect()
  pair.right.send(['error', 'wrong-subprotocol'])
  pair.right.disconnect()
  await pair.wait()
  equal(recon.reconnecting, false)
})

test('disconnects and unbind listeners on destroy', async () => {
  let pair = new TestPair()
  let origin = privateMethods(pair.left).emitter.events.connect.length

  let recon = new Reconnect(pair.left)
  notEqual(privateMethods(pair.left).emitter.events.connect.length, origin)

  await recon.connect()
  recon.destroy()
  await pair.wait()
  equal(privateMethods(pair.left).emitter.events.connect.length, origin)
  equal(pair.right.connected, false)
})

test('reconnects automatically with delay', async () => {
  let pair = new TestPair()
  let recon = new Reconnect(pair.left, { maxDelay: 50, minDelay: 50 })
  await recon.connect()
  pair.right.disconnect()
  await pair.wait()
  equal(pair.right.connected, false)
  await delay(70)
  equal(pair.right.connected, true)
})

test('allows to disable reconnecting', async () => {
  let pair = new TestPair()
  let recon = new Reconnect(pair.left)
  await recon.connect()
  recon.reconnecting = false
  pair.right.disconnect()
  await pair.wait()
  await delay(1)
  equal(pair.right.connected, false)
})

test('has maximum reconnection attempts', async () => {
  let pair = new TestPair()
  let connects = 0
  pair.left.connect = () => {
    connects += 1
    privateMethods(pair.left).emitter.emit('disconnect')
    return Promise.resolve()
  }

  let recon = new Reconnect(pair.left, {
    attempts: 3,
    maxDelay: 0,
    minDelay: 0
  })

  recon.connect()

  await delay(10)
  equal(recon.reconnecting, false)
  equal(connects, 3)
})

test('tracks connecting state', () => {
  let pair = new TestPair()
  let recon = new Reconnect(pair.left, {
    maxDelay: 5000,
    minDelay: 1000
  })

  equal(recon.connecting, false)

  privateMethods(pair.left).emitter.emit('connecting')
  equal(recon.connecting, true)

  privateMethods(pair.left).emitter.emit('disconnect')
  equal(recon.connecting, false)

  privateMethods(pair.left).emitter.emit('connecting')
  privateMethods(pair.left).emitter.emit('connect')
  equal(recon.connecting, false)
})

test('has dynamic delay', () => {
  let pair = new TestPair()
  let recon = new Reconnect(pair.left, {
    maxDelay: 5000,
    minDelay: 1000
  })

  function attemptsIsAround(attempt: number, ms: number): void {
    recon.attempts = attempt
    let time = privateMethods(recon).nextDelay()
    ok(Math.abs(time - ms) < 1000)
  }

  attemptsIsAround(0, 1000)
  attemptsIsAround(1, 2200)
  attemptsIsAround(2, 4500)
  attemptsIsAround(3, 5000)

  function attemptsequal(attempt: number, ms: number): void {
    recon.attempts = attempt
    let time = privateMethods(recon).nextDelay()
    equal(time, ms)
  }

  for (let i = 4; i < 100; i++) {
    attemptsequal(i, 5000)
  }
})

test('listens for window events', async () => {
  let pair = new TestPair()
  let recon = new Reconnect(pair.left, { maxDelay: 0 })

  await recon.connect()
  pair.right.disconnect()
  await pair.wait()
  equal(recon.connected, false)

  setHidden(true)
  listeners.visibilitychange()
  equal(recon.connecting, false)

  setHidden(false)
  await pair.wait()
  equal(recon.connected, true)

  listeners.freeze()
  await delay(10)

  equal(recon.connecting, false)
  equal(recon.connected, false)

  setOnLine(false, 'resume')
  equal(recon.connecting, false)

  setOnLine(true, 'resume')
  await delay(10)
  equal(recon.connected, true)
  pair.right.disconnect()
  await pair.wait()
  equal(recon.connected, false)

  setOnLine(true, 'online')
  await pair.wait()
  equal(recon.connected, true)

  recon.destroy()
  deepStrictEqual(Object.keys(listeners), [])
})

test('does connect on online if client was not connected', async () => {
  let pair = new TestPair()
  new Reconnect(pair.left)

  let connect = spyOn(Reconnect.prototype, 'connect')

  listeners.visibilitychange()
  equal(connect.callCount, 0)

  listeners.online()
  equal(connect.callCount, 0)
})
