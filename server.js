import {WebSocketServer} from 'ws';
import {v4 as uuidv4} from 'uuid'
import { parse } from 'url';

const wss = new WebSocketServer({port: 3000})

const playerSet = new Map()
const playerIdConnectionIdMap = new Map()

function broadcastLobbyUpdate() {
	let players = Array.from(playerSet.values())
		.map(player => (player.playerData))

	console.log('Lobby Status: ' + JSON.stringify(players))
	const lobbyUpdateMessage = JSON.stringify({type: 'lobby', action: 'update-players', players})

	wss.clients.forEach((client) => {
		if (client.readyState === client.OPEN) {
			client.send(lobbyUpdateMessage)
		}
	})
}

wss.on('connection', (ws, req) => {
	const params = new URLSearchParams(parse(req.url, true).query)

	let connectionId = params.get('connectionId')
	if (!connectionId) {
		connectionId = uuidv4();
	}
	ws.id = connectionId;

	const joinMessage = JSON.stringify({type: "connection", connectionId})

	ws.send(joinMessage)
	console.log('Client connected.')

	ws.on('message', (data) => {
		let message = JSON.parse(data.toString())
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


const messageHandler = (message, ws) => {
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

const matchMessageHandler = (message, ws) => {
	switch (message.action) {
		case 'request-match':
			startMatch(message.playerId, message.opponentId)
			break;
		default:
			console.error(`Unsupported Match Action: ${message.action}`)
	}
}

const startMatch = (playerId, opponentId) => {
	let player = getPlayerById(playerId)
	let opponent = getPlayerById(opponentId)

	if (!player || !opponent) {
		console.log("Something went wrong starting match: Player or Opponent not found.")
		return
	}

	console.log(`Starting match between ${player.playerData.userName} and ${opponent.playerData.userName}`)
}

const lobbyMessageHandler = (message, ws) => {
	switch (message.action) {
		case 'joining':
			// TODO: have legit login/userId/Auth system.
			let playerId = uuidv4()
			let playerData = {playerId, userName: message.userName, playerLocation: 'lobby', rating: '12/100'}
			playerSet.set(ws.id, {playerData, ws})
			playerIdConnectionIdMap.set(playerId, ws.id)
			const loggedInMessage = JSON.stringify({type: 'lobby', action: 'logged-in', playerData})
			ws.send(loggedInMessage)
			broadcastLobbyUpdate()
			break;
		default:
			console.error(`Unsupported Lobby Action: ${message.action}`)
	}
}

const getPlayerById = (playerId) => {
	if (!playerId) {
		return null
	}
	const connectionId = playerIdConnectionIdMap.get(playerId)
	if (!connectionId) {
		return null
	}
	return playerSet.get(connectionId)
}