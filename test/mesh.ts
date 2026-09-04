import type { NetMsg, Transport } from '../src/transport/types'

/**
 * Deterministic in-memory broadcast bus standing in for the MQTT brokers:
 * messages queue centrally and deliver on flush(); a filter hook drops
 * deliveries for loss tests; peers can drop and rejoin.
 */
export class Mesh {
  private peers = new Map<string, MeshPeer>()
  private queue: { to: string; from: string; msg: NetMsg }[] = []
  filter: (msg: NetMsg, from: string, to: string) => boolean = () => true

  createPeer(id: string): Transport {
    const peer = new MeshPeer(this, id)
    this.peers.set(id, peer)
    return peer
  }

  announce(id: string): void {
    const peer = this.peers.get(id)!
    for (const [otherId, o] of this.peers) {
      if (otherId === id) continue
      o.fireJoin(id)
      peer.fireJoin(otherId)
    }
  }

  drop(id: string): void {
    this.peers.delete(id)
    this.queue = this.queue.filter((d) => d.to !== id && d.from !== id)
    for (const o of this.peers.values()) o.fireLeave(id)
  }

  enqueue(from: string, msg: NetMsg): void {
    for (const t of this.peers.keys()) if (t !== from) this.queue.push({ to: t, from, msg })
  }

  flush(): void {
    while (this.queue.length > 0) {
      const d = this.queue.shift()!
      if (!this.filter(d.msg, d.from, d.to)) continue
      this.peers.get(d.to)?.deliver(d.msg, d.from)
    }
  }
}

class MeshPeer implements Transport {
  private messageHandlers: ((msg: NetMsg, from: string) => void)[] = []
  private joinHandlers: ((peerId: string) => void)[] = []
  private leaveHandlers: ((peerId: string) => void)[] = []

  constructor(
    private mesh: Mesh,
    readonly selfId: string,
  ) {}

  send(msg: NetMsg): void {
    this.mesh.enqueue(this.selfId, JSON.parse(JSON.stringify(msg)) as NetMsg)
  }
  onMessage(fn: (msg: NetMsg, from: string) => void): void {
    this.messageHandlers.push(fn)
  }
  onPeerJoin(fn: (peerId: string) => void): void {
    this.joinHandlers.push(fn)
  }
  onPeerLeave(fn: (peerId: string) => void): void {
    this.leaveHandlers.push(fn)
  }
  close(): void {}
  relayCount(): number {
    return 1
  }
  deliver(msg: NetMsg, from: string): void {
    for (const fn of this.messageHandlers) fn(msg, from)
  }
  fireJoin(peerId: string): void {
    for (const fn of this.joinHandlers) fn(peerId)
  }
  fireLeave(peerId: string): void {
    for (const fn of this.leaveHandlers) fn(peerId)
  }
}
