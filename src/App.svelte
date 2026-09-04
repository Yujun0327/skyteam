<script lang="ts">
  import { loadPlayerName, playerKey } from './app/persist'
  import { OnlineSession, SoloSession } from './app/session.svelte'
  import type { AbilityId } from './engine'
  import { makeRoomCode } from './transport/mqtt'
  import GameScreen from './ui/GameScreen.svelte'
  import Home from './ui/Home.svelte'
  import Lab from './ui/Lab.svelte'
  import Lobby from './ui/Lobby.svelte'
  import { stopHum } from './ui/audio'

  let hash = $state(location.hash)
  let solo = $state<SoloSession | null>(null)
  let online = $state<OnlineSession | null>(null)

  function roomFromHash(): string | null {
    const m = location.hash.match(/room=([A-Za-z0-9]{4,})/)
    return m ? m[1].toUpperCase() : null
  }

  function syncFromHash() {
    const room = roomFromHash()
    if (room && online?.room !== room) {
      online?.destroy()
      const creator = sessionStorage.getItem(`skyteam:creator:${room}`) !== null
      online = new OnlineSession(room, creator, { key: playerKey(), name: loadPlayerName() })
    } else if (!room && online) {
      online.destroy()
      online = null
    }
  }

  syncFromHash()
  $effect(() => {
    const handler = () => {
      hash = location.hash
      syncFromHash()
    }
    window.addEventListener('hashchange', handler)
    return () => window.removeEventListener('hashchange', handler)
  })

  const showLab = $derived(hash.startsWith('#lab'))

  $effect(() => {
    ;(window as unknown as Record<string, unknown>).__skyteam = online ?? solo
  })

  function startSolo(scenarioId: string, abilities: AbilityId[]) {
    solo = new SoloSession(scenarioId, abilities)
  }
  function createRoom() {
    const code = makeRoomCode()
    sessionStorage.setItem(`skyteam:creator:${code}`, '1')
    location.hash = `room=${code}`
  }
  function joinRoom(code: string) {
    location.hash = `room=${code.toUpperCase()}`
  }
  function exitToHome() {
    stopHum()
    solo = null
    if (online) {
      online.leave()
      online = null
    }
    if (location.hash) location.hash = ''
  }
  function rematch() {
    if (solo) solo = solo.rematch()
    else online?.requestRematch()
  }
</script>

{#if showLab}
  <Lab />
{:else if online}
  {#if online.playing}
    <GameScreen session={online} onExit={exitToHome} onRematch={rematch} />
  {:else}
    <Lobby session={online} onExit={exitToHome} />
  {/if}
{:else if solo}
  <GameScreen session={solo} onExit={exitToHome} onRematch={rematch} />
{:else}
  <Home onSolo={startSolo} onCreateRoom={createRoom} onJoinRoom={joinRoom} />
{/if}
