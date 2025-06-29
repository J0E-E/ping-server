import {Vector2} from "../types/matchTypes";

export default class MatchState {
    playerReady: boolean
    opponentReady: boolean
    ballPosition: Vector2
    ballVelocity: Vector2
    playerPaddlePosition: number
    opponentPaddlePosition: number
    playerScore: number
    opponentScore: number
    winningScore: number

    constructor() {
        // TODO: Have the players confirm ready state.
        this.playerReady = true
        this.opponentReady = true
        this.ballPosition = { x: 0, y: 0 }
        this.ballVelocity = { x: 0, y: 0 }
        this.playerPaddlePosition = 0
        this.opponentPaddlePosition = 0
        this.playerScore = 0
        this.opponentScore = 0
        this.winningScore = 10;
    }
}