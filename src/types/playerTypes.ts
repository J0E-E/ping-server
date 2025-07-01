import {PingWebSocket} from "../../server";

export interface PlayerData {
    playerId: string
    userName: string
    playerLocation: 'lobby' | 'match'
    wins: number
    losses: number
    xMovement?: number
}

export interface Player {
    playerData: PlayerData
    ws: PingWebSocket
}

export type PlayerType = 'Player' | 'Opponent'

export function isValidPlayerType(value: any): value is PlayerType {
    return value === 'Player' || value === 'Opponent';
}