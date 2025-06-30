import {PingWebSocket} from "../../server";

export interface PlayerData {
    playerId: string
    userName: string
    playerLocation: 'lobby' | 'match'
    wins: number
    losses: number
}

export interface Player {
    playerData: PlayerData
    ws: PingWebSocket
}

export type PlayerType = 'Player' | 'Opponent'