import {WebSocketServer, WebSocket} from 'ws';
import {v4 as uuidv4} from 'uuid'
import {Player, PlayerData} from "./src/types/playerTypes";
import {
	ClientMessage,
	ConnectionMessage, LobbyMessage,
	LobbyUpdateMessage,
	LoggedInMessage,
	MatchMessage, MatchRequestedMessage
} from "./src/types/messageTypes";
import Match from "./src/match/Match";
import {
	createConnectionMessage,
	createLobbyUpdateMessage,
	createLoggedInMessage,
	createMatchRequestedMessage
} from "./src/messages/messageFactory";

export interface PingWebSocket extends WebSocket {
	id: string
}

const wss = new WebSocketServer({port: 3000})

const playerSet = new Map<string, Player>()

const playerIdConnectionIdMap = new Map<string, string>()

function broadcastLobbyUpdate() {
	let players = Array.from(playerSet.values())
		.map(player => (player.playerData))

	console.log(`Lobby Status - ${players.length} player(s) - ` + JSON.stringify(players.map((player)=> player.userName)))
	const lobbyUpdateMessage = createLobbyUpdateMessage(players)
	const message = JSON.stringify(lobbyUpdateMessage)

	wss.clients.forEach((client) => {
		if (client.readyState === client.OPEN) {
			client.send(message)
		}
	})
}

wss.on('connection', (ws: PingWebSocket, req) => {
	const url = new URL(req.url || '', `http://localhost:3000`)
	const params = url.searchParams

	let connectionId = params.get('connectionId')
	if (!connectionId) {
		connectionId = uuidv4();
	}
	ws.id = connectionId;

	const connectionMessage = createConnectionMessage(connectionId)
	const message = JSON.stringify(connectionMessage)

	ws.send(message)
	console.log('Client connected.')

	ws.on('message', (data) => {
		let message = JSON.parse(data.toString()) as ClientMessage
		messageHandler(message, ws)
	})

	ws.on('close', (code, reason) => {
		console.log(`Client disconnected. Code: ${code}, Reason: ${reason.toString()}`);
		const player = playerSet.get(ws.id)
		if (player) {
			// TODO: handle with a timeout. Allow for reconnect in x amount of time.
			console.log(`Player Removed: ${player.playerData.userName}-${player.playerData.playerId}`)
			playerSet.delete(ws.id)
			playerIdConnectionIdMap.delete(player.playerData.playerId)
			broadcastLobbyUpdate()
		}
	});

	ws.on('error', (error) => {
		console.error('WebSocket error:', error);
	});
})


const messageHandler = (message: ClientMessage, ws: PingWebSocket) => {
	switch (message.type){
		case 'lobby':
			lobbyMessageHandler(message, ws)
			break;
		case 'match':
			matchMessageHandler(message, ws)
			break;
		default:
			console.log("NOT SUPPORTED, BITCH!")
	}
}

const matchMessageHandler = (message: MatchMessage, ws: PingWebSocket) => {
	switch (message.action) {
		case 'request-match': {
			let player = getPLayerByConnectionId(ws.id)
			let opponent = getPlayerById(message.opponentId)
			if (player && opponent && opponent?.ws) {
				const matchRequestedMessage = createMatchRequestedMessage(player.playerData)
				opponent.ws.send(JSON.stringify(matchRequestedMessage))
			}
			break
		}
		case 'accept-match': {
			const player = getPlayerById(message.playerId)
			const opponent = getPLayerByConnectionId(ws.id)
			if (player && opponent) {
				startMatch(player, opponent)
			}
			break
		}
		case 'ready-to-play':
			const player = getPLayerByConnectionId(ws.id)
			const match = Match.matches.get(message.matchId)
			if (!player || !match || !match.players.includes(player.playerData.playerId)) {
				console.error('Invalid player or match for setting ready-to-play.')
				return
			}
			console.log(message.playerType)
			match.playerReady(message.playerType)
			break
		default: {
			console.error(`Unsupported Match Action: ${message.action}`)
		}
	}
}

const startMatch = (player: Player, opponent: Player) => {
	if (!player || !opponent) {
		console.log("Something went wrong starting match: Player or Opponent not found.")
		return
	}
	const match = new Match(player, opponent)
}

const lobbyMessageHandler = (lobbyMessage: LobbyMessage, ws: PingWebSocket) => {
	switch (lobbyMessage.action) {
		case 'joining':
			// TODO: have legit login/userId/Auth system.
			let playerId = uuidv4()
			let playerData: PlayerData = {playerId, userName: lobbyMessage.userName, playerLocation: 'lobby', wins: 0, losses: 0}
			playerSet.set(ws.id, {playerData, ws})
			playerIdConnectionIdMap.set(playerId, ws.id)
			const loggedInMessage = createLoggedInMessage(playerData)
			const message = JSON.stringify(loggedInMessage)
			ws.send(message)
			broadcastLobbyUpdate()
			break;
		default:
			console.error(`Unsupported Lobby Action: ${lobbyMessage.action}`)
	}
}

const getPlayerById = (playerId: string): Player | undefined => {
	if (!playerId) {
		return undefined
	}
	const connectionId = playerIdConnectionIdMap.get(playerId)
	if (!connectionId) {
		return undefined
	}
	return playerSet.get(connectionId)
}

const getPLayerByConnectionId = (connectionId: string): Player | undefined => {
	if (!connectionId) {
		return undefined
	}
	return playerSet.get(connectionId)
}