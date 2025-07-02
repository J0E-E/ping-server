import {Player, PlayerData, PlayerType} from "./playerTypes";
import MatchState from "../match/MatchState";
import Match from "../match/Match";

// CLIENT MESSAGES (INCOMING)
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
    action: 'request-match' | 'accept-match' | 'ready-to-play' | 'move-paddle' | 'release-ball'
    playerId: string
    opponentId: string
    matchId: string
    playerType: PlayerType
    xMovement: number
}

export type ClientMessage = LobbyMessage | MatchMessage

// SERVER MESSAGES (OUTGOING)
export type BaseServerMessage = {
    type: 'connection' | 'lobby' | 'match'
    action: string
}

export interface LobbyUpdateMessage extends BaseServerMessage {
    type: 'lobby'
    action: 'update-players'
    players: PlayerData[]
}

export interface LoggedInMessage extends BaseServerMessage {
    type: 'lobby'
    action: 'logged-in'
    playerData: PlayerData
}

export interface ConnectionMessage extends BaseServerMessage {
    type: 'connection'
    action: 'connected'
    connectionId: string
}

export interface MatchAcceptedMessage extends BaseServerMessage {
    type: 'match'
    action: 'match-accepted'
    matchId: string
    playerType: 'Player' | 'Opponent'
    matchState: MatchState
}

export interface MatchRequestedMessage extends BaseServerMessage {
    type: 'match'
    action: 'match-requested'
    player: PlayerData
}

export interface MatchStateUpdateMessage extends BaseServerMessage {
    type: 'match'
    action: 'update-match-state'
    matchState: MatchState
}

export type ServerMessage = LobbyUpdateMessage | LoggedInMessage | ConnectionMessage | MatchAcceptedMessage