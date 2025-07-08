import {PlayerData, PlayerType} from "../types/playerTypes";
import {
    ConnectionMessage,
    LobbyUpdateMessage,
    LoggedInMessage,
    MatchAcceptedMessage, MatchEndedMessage,
    MatchRequestedMessage, MatchStateUpdateMessage
} from "../types/messageTypes";
import MatchState from "../match/MatchState";

export function createLobbyUpdateMessage(players: PlayerData[]): LobbyUpdateMessage {
    return {
        type: 'lobby',
        action: 'update-players',
        players
    }
}

export function createLoggedInMessage(playerData: PlayerData): LoggedInMessage {
    return {
        type: 'lobby',
        action: 'logged-in',
        playerData
    }
}

export function createConnectionMessage(connectionId: string): ConnectionMessage {
    return {
        type: 'connection',
        action: 'connected',
        connectionId
    }
}

export function createMatchRequestedMessage(playerData: PlayerData): MatchRequestedMessage {
    return {
        type: 'match',
        action: 'match-requested',
        player: playerData
    }
}

export function createMatchAcceptedMessage(matchId: string, playerType: PlayerType, matchState: MatchState): MatchAcceptedMessage {
    return {
        type: 'match',
        action: 'match-accepted',
        matchId,
        playerType,
        matchState
    }
}

export function createMatchUpdateStateMessage(matchState: MatchState): MatchStateUpdateMessage {
    return {
        type: 'match',
        action: 'update-match-state',
        matchState: matchState
    }
}

export function createMatchEndedMessage(matchId: string): MatchEndedMessage {
    return {
        type: 'match',
        action: 'match-ended',
        matchId: matchId
    }
}