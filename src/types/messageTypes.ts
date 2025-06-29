import {PlayerData} from "./playerTypes";
import MatchState from "../match/MatchState";

export type BaseClientMessage = {
    type: 'lobby' | 'match'
    action: string
}

export interface LobbyMessage extends BaseClientMessage {
    type: 'lobby'
    action: 'joining' | 'leaving'
    userName: string
}

export interface MatchMessage extends BaseClientMessage {
    type: 'match'
    action: 'request-match'
    playerId: string
    opponentId: string
}

export type ClientMessage = LobbyMessage | MatchMessage

export interface LobbyUpdateMessage {
    type: 'lobby'
    action: 'update-players'
    players: PlayerData[]
}

export interface LoggedInMessage {
    type: 'lobby'
    action: 'logged-in'
    playerData: PlayerData
}

export interface ConnectionMessage {
    type: 'connection'
    connectionId: string
}

export interface MatchInitializedMessage {
    type: 'match'
    action: 'match-initialized'
    matchId: string
    playerType: 'Player' | 'Opponent'
    matchState: MatchState
}

export type ServerMessage = LobbyUpdateMessage | LoggedInMessage | ConnectionMessage