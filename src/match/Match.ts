import {Player, PlayerType} from "../types/playerTypes";
import {PingWebSocket} from "../../server";
import {v4 as uuidv4} from 'uuid'
import MatchState from "./MatchState";
import {createMatchAcceptedMessage, createMatchUpdateStateMessage} from "../messages/messageFactory";

export default class Match {
    static matches: Map<string, Match> = new Map()
    matchId: string
    player: Player
    opponent: Player
    players: string[]
    matchWebSockets: Set<PingWebSocket>
    matchState: MatchState

    constructor(player: Player, opponent: Player) {
        if (!player?.ws || !opponent?.ws) {
            throw new Error('Invalid player or opponent WebSocket connection')
        }

        if (player.playerData.playerId === opponent.playerData.playerId) {
            throw new Error('Cannot create match with same player')
        }

        this.matchId = uuidv4()
        Match.matches.set(this.matchId, this)
        this.player = player
        this.opponent = opponent
        this.players = [player.playerData.playerId, opponent.playerData.playerId]
        this.matchWebSockets = new Set([player.ws, opponent.ws])
        this.matchState = new MatchState()

        this.initializeMatch()
    }

    destroy() {
        Match.matches.delete(this.matchId)
    }

    static getMatch(matchId: string): Match | undefined {
        return Match.matches.get(matchId)
    }

    static getActiveMatchesCount(): number {
        return Match.matches.size
    }

    get MatchId() {return this.matchId}

    initializeMatch() {
        console.log(`Match: Starting match between ${this.player.playerData.userName} and ${this.opponent.playerData.userName}. MatchId: ${this.matchId}`)

        const playerInitialization = createMatchAcceptedMessage(this.matchId, 'Player', this.matchState)
        const opponentInitialization = createMatchAcceptedMessage(this.matchId, 'Opponent', this.matchState)

        this.messagePlayer(playerInitialization)
        this.messageOpponent(opponentInitialization)
    }

    playerReady(playerType: PlayerType) {
        switch (playerType) {
            case "Player":
                this.matchState.playerReady = true;
                break
            case "Opponent":
                this.matchState.opponentReady = true;
                break
            default:
                console.error("Unsupported PlayerType in Match.playerReady")
                return
        }
        this.broadcastToMatch(createMatchUpdateStateMessage(this.matchState))
    }

    messagePlayer(message: any) {
        const messageStr = JSON.stringify(message)
        if (this.player.ws && this.player.ws.readyState === this.player.ws.OPEN) {
            console.log(`PlayerMessage: ${messageStr}`)
            this.player.ws.send(messageStr)
        }
    }

    messageOpponent(message: any) {
        const messageStr = JSON.stringify(message)
        if (this.opponent.ws && this.opponent.ws.readyState === this.opponent.ws.OPEN) {
            console.log(`OpponentMessage: ${messageStr}`)
            this.opponent.ws.send(messageStr)
        }
    }

    broadcastToMatch(message: any) {
        const messageStr = JSON.stringify(message)
        this.matchWebSockets.forEach((ws: PingWebSocket) => {
            if (ws && ws.readyState === ws.OPEN) {
                console.log(`Sending message: ${messageStr}`)
                ws.send(messageStr)
            }
        })
    }
}