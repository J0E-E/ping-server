import {WebSocketServer} from 'ws';
import {v4 as uuidv4} from 'uuid'
import { parse } from 'url';

const wss = new WebSocketServer({port: 3000})

const playerLobby = new Map()

wss.on('connection', (ws, req) => {
	const params = new URLSearchParams(parse(req.url, true).query)
	let connectionId = params.get('connectionId')
	if (!connectionId) {
		connectionId = uuidv4();
	}
	const joinMessage = JSON.stringify({type: "connect", connectionId})
	ws.send(joinMessage)

	console.log('Client connected.')

	ws.on('message', (data) => {
		const message = data.toString()
		console.log('Received message: ', message)

		ws.send(`Echo: ${message}`)
	})


})