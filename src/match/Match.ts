import {Player, PlayerType} from "../types/playerTypes";
import {PingWebSocket} from "../../server";
import {v4 as uuidv4} from 'uuid'
import MatchState from "./MatchState";
import {
    createMatchAcceptedMessage,
    createMatchEndedMessage,
    createMatchUpdateStateMessage
} from "../messages/messageFactory";
import {clearInterval} from "node:timers";

const MAX_BOUNCE_ANGLE: number = (60 * Math.PI) / 180; // 60 degrees bounce angle max

export default class Match {
    static matches: Map<string, Match> = new Map()
    private static gameLoopInterval: NodeJS.Timeout | null = null
    isActive: boolean = false
    matchId: string
    player: Player
    opponent: Player
    players: string[]
    matchWebSockets: Set<PingWebSocket>
    matchState: MatchState
    maxPaddleBound: number = 22
    minPaddleBound: number = -(this.maxPaddleBound)
    paddleSpeed: number = 10
    lastUpdateTime: number = 0
    deltaTime: number = 0
    lastBroadcastTime: number = 0
    broadcastInterval: number = 100
    initialBallVelocity: { x: number, y: number } = {x: 0, y: 15}
    isPaused: boolean = false;

    constructor(player: Player, opponent: Player) {
        if (!player?.ws || !opponent?.ws) {
            throw new Error('Invalid player or opponent WebSocket connection')
        }

        if (player.playerData.playerId === opponent.playerData.playerId) {
            throw new Error('Cannot create match with same player')
        }

        // get uuid for match and add match to match set.
        this.matchId = uuidv4()
        Match.matches.set(this.matchId, this)

        // set player and opponent to match
        this.player = player
        this.player.playerData.inMatch = true
        this.player.playerData.playerType = 'Player'
        this.opponent = opponent
        this.opponent.playerData.inMatch = true
        this.opponent.playerData.playerType = 'Opponent'
        this.players = [player.playerData.playerId, opponent.playerData.playerId]

        this.matchWebSockets = new Set([player.ws, opponent.ws])
        this.matchState = new MatchState()

        this.initializeMatch()
    }

    public pauseMatch() {
        this.isPaused = true
    }

    static startGameLoop() {
        if (this.gameLoopInterval) return

        this.gameLoopInterval = setInterval(() => {
            this.updateAllMatches()
        }, 16)

        console.log('Game Loop Started')
    }

    static stopGameLoop() {
        if (this.gameLoopInterval) {
            clearInterval(this.gameLoopInterval)
            this.gameLoopInterval = null
        }
    }

    endMatch() {
        this.player.playerData.inMatch = false
        this.opponent.playerData.inMatch = false
        console.log(`Match ended. MatchId: ${this.matchId}`)
        Match.matches.delete(this.matchId)
        this.broadcastToMatch(createMatchEndedMessage(this.matchId))
    }

    private static updateAllMatches() {
        this.matches.forEach((match) => {
            if (match.isPaused) return

            match.updateMatch()
        })
    }

    static findMatchByPlayerId(playerId: string): Match | undefined {
        for (const match of this.matches.values()) {
            if (match.players.includes(playerId)) {
                return match
            }
        }
        return undefined
    }

    private updateMatch() {
        if (!this.isActive) return

        // calculate deltaTime
        const currentTime = Date.now()
        this.deltaTime = this.lastUpdateTime ? (currentTime - this.lastUpdateTime) / 1000 : 0
        this.lastUpdateTime = currentTime

        if (this.player.playerData.xMovement) this.updatePaddlePosition(this.player)
        if (this.opponent.playerData.xMovement) this.updatePaddlePosition(this.opponent)

        if (!this.matchState.isBallInPlay) this.updateBallStartingPosition()
        else {
            this.updateBallPosition()
            this.checkWallCollisions()
            this.checkAndCalculatePaddleBallCollision()
            this.checkScoringCondition()
            this.checkWinCondition()
        }

        if (currentTime - this.lastBroadcastTime >= this.broadcastInterval) {
            this.broadcastToMatch(createMatchUpdateStateMessage(this.matchState))
            this.lastBroadcastTime = currentTime
        }
    }

    private updateBallPosition() {
        this.matchState.ballPosition = {
            x: Math.round((this.matchState.ballPosition.x + (this.matchState.ballVelocity.x * this.deltaTime)) * 100) / 100,
            y: Math.round((this.matchState.ballPosition.y + (this.matchState.ballVelocity.y * this.deltaTime)) * 100) / 100
        }
    }

    private checkWallCollisions() {
        if (Math.abs(this.matchState.ballPosition.x) >= 24.5) {
            this.matchState.ballPosition.x = this.matchState.ballPosition.x > 0 ? 24.4 : -24.4
            this.matchState.ballVelocity.x *= -1
        }
    }

    private checkAndCalculatePaddleBallCollision() {

        if (Math.abs(this.matchState.ballPosition.y) >= 44.5 && Math.abs(this.matchState.ballPosition.y) <= 45) {
            let potentialPaddle = this.calculatePaddleBoundaries(
                this.matchState.ballPosition.y > 0 ? this.matchState.opponentPaddlePosition * -1 : this.matchState.playerPaddlePosition
            )
            if (
                this.matchState.ballPosition.x >= potentialPaddle.min &&
                this.matchState.ballPosition.x <= potentialPaddle.max
            ) {
                // get a normalized -1 to 1 value for the ball hit location on the paddle.
                const relativeHitLocation = this.calculateRelativeHit(potentialPaddle)
                console.log(`Relative Hit Location: ${relativeHitLocation}`)
                // calculate the new bounce angle.
                const bounceAngle = relativeHitLocation * MAX_BOUNCE_ANGLE
                console.log(`Bounce Angle: ${bounceAngle}`)

                // Get ball speed to keep the magnitude.
                const speed = Math.sqrt(
                    this.matchState.ballVelocity.x ** 2 +
                    this.matchState.ballVelocity.y ** 2
                )
                console.log(`Speed: ${speed}`)

                // Get new direction: if the ball was going up, now it goes down and vice versa.
                const direction = this.matchState.ballVelocity.y > 0 ? -1 : 1
                console.log(`Direction: ${direction}`)

                // Set new velocity components
                this.matchState.ballVelocity.x = speed * Math.sin(bounceAngle)
                this.matchState.ballVelocity.y = speed * Math.cos(bounceAngle) * direction
                console.log(`VeloX: ${speed * Math.sin(bounceAngle)}`)
                console.log(`VeloY: ${speed * Math.cos(bounceAngle) * direction}`)

                // Adjust ball position slightly, so it doesn't recollide immediately.
                this.matchState.ballPosition.y = this.matchState.ballPosition.y > 0 ? 44.4 : -44.4
            }
        }
    }

    private calculateRelativeHit(paddleBounds: {min: number, max: number}) {
        const ballX = this.matchState.ballPosition.x
        const midpoint = (paddleBounds.min + paddleBounds.max) / 2
        const halfWidth = (paddleBounds.max - paddleBounds.min) / 2
        return Math.max(-1, Math.min(1, (ballX - midpoint) / halfWidth))
    }

    private checkScoringCondition() {
        if (Math.abs(this.matchState.ballPosition.y) > 45) {
            const scoringPlayer = this.matchState.ballPosition.y > 0 ? this.player : this.opponent
            this.matchState.isBallInPlay = false
            this.scorePoint(scoringPlayer)
            this.matchState.ballPossession = scoringPlayer.playerData.playerType
            this.initializeBallPosition()
        }
    }

    private scorePoint(player: Player) {
        switch (player.playerData.playerType) {
            case 'Player':
                this.matchState.playerScore += 1
                break
            case 'Opponent':
                this.matchState.opponentScore += 1
                break
            default:
                return
        }
    }

    private checkWinCondition() {
        if (this.matchState.playerScore === this.matchState.winningScore) {
            this.matchState.winner = 'Player'
        }
        if (this.matchState.opponentScore === this.matchState.winningScore) {
            this.matchState.winner = 'Opponent'
        }
    }

    private calculatePaddleBoundaries(position: number): {min: number, max: number} {
        return {min: position - 3, max: position +3}
    }

    private updateBallStartingPosition() {

        switch (this.matchState.ballPossession) {
            case "Player":
                this.matchState.ballPosition = {
                    x: this.matchState.playerPaddlePosition,
                    y: this.matchState.ballPosition.y
                }
                break
            case "Opponent":
                this.matchState.ballPosition = {
                    x: this.matchState.opponentPaddlePosition * -1,
                    y: this.matchState.ballPosition.y
                }
                break
            default:
                console.error("Something went wrong updating ball starting position.")
        }
    }


    private updatePaddlePosition(player: Player) {
        const isPlayer = player === this.player
        const currentPosition = isPlayer ?
            this.matchState.playerPaddlePosition :
            this.matchState.opponentPaddlePosition

        const movement = player.playerData.xMovement
        if (movement) {
            const newPosition = currentPosition + (movement * this.paddleSpeed * this.deltaTime)

            const clampedPosition = Math.max(this.minPaddleBound,
                Math.min(this.maxPaddleBound, newPosition))

            if (isPlayer) {
                this.matchState.playerPaddlePosition = Math.round(clampedPosition * 100) / 100
            } else {
                this.matchState.opponentPaddlePosition = Math.round(clampedPosition * 100) / 100
            }
        }
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

    get MatchId() {
        return this.matchId
    }

    private initializeMatch() {
        console.log(`Match: Starting match between ${this.player.playerData.userName} and ${this.opponent.playerData.userName}. MatchId: ${this.matchId}`)

        const playerInitialization = createMatchAcceptedMessage(this.matchId, 'Player', this.matchState)
        const opponentInitialization = createMatchAcceptedMessage(this.matchId, 'Opponent', this.matchState)

        this.messagePlayer(playerInitialization)
        this.messageOpponent(opponentInitialization)
    }

    private initializeBallPosition() {
        this.matchState.ballPosition = {x: 0, y: 43 * (this.matchState.ballPossession === 'Player' ? -1 : 1)}
        console.log("Ball initialized.")
    }

    private messagePlayer(message: any) {
        const messageStr = JSON.stringify(message)
        if (this.player.ws && this.player.ws.readyState === this.player.ws.OPEN) {
            console.log(`PlayerMessage: ${messageStr}`)
            this.player.ws.send(messageStr)
        }
    }

    private messageOpponent(message: any) {
        const messageStr = JSON.stringify(message)
        if (this.opponent.ws && this.opponent.ws.readyState === this.opponent.ws.OPEN) {
            console.log(`OpponentMessage: ${messageStr}`)
            this.opponent.ws.send(messageStr)
        }
    }

    private broadcastToMatch(message: any) {
        const messageStr = JSON.stringify(message)
        this.matchWebSockets.forEach((ws: PingWebSocket) => {
            if (ws && ws.readyState === ws.OPEN) {
                ws.send(messageStr)
            }
        })
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

        if (this.matchState.playerReady && this.matchState.opponentReady) {
            this.isActive = true
            this.initializeBallPosition()
        }
    }

    releaseBall() {
        const playerWithPossession = this.matchState.ballPossession === 'Player' ? this.player : this.opponent
        this.matchState.ballVelocity = {
            x: this.initialBallVelocity.x + (15 * (playerWithPossession.playerData.xMovement || 0) * (this.matchState.ballPossession == 'Player' ? 1 : -1)),
            y: this.initialBallVelocity.y * (this.matchState.ballPossession == 'Player' ? 1 : -1)}
        this.matchState.isBallInPlay = true
        this.matchState.ballPossession = undefined
    }
}