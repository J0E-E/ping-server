import {WebSocketServer} from 'ws';
import {v4 as uuidv4} from 'uuid'
import { parse } from 'url';

const wss = new WebSocketServer({port: 3000})

const playerSet = new Map()

function broadcastLobbyUpdate() {
	let players = Array.from(playerSet.values())
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
			console.log(`Player Removed: ${player.userName}-${player.playerId}`)
			playerSet.delete(ws.id)
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
		default:
			console.log("NOT SUPPORTED, BITCH!")
	}
}

const lobbyMessageHandler = (message, ws) => {
	switch (message.action) {
		case 'joining':
			// TODO: have legit login/userId/Auth system.
			let playerId = uuidv4()
			let playerData = {playerId, userName: message.userName, playerLocation: 'lobby', rating: '12/100'}
			playerSet.set(message.connectionId, playerData)
			const loggedInMessage = JSON.stringify({type: 'lobby', action: 'logged-in', playerData})
			ws.send(loggedInMessage)
			broadcastLobbyUpdate()
			break;
		default:
			console.error(`Unsupported Lobby Action: ${message.action}`)
	}
}