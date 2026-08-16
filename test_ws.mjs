import WebSocket from 'ws';
const ws = new WebSocket('ws://localhost:3000/api/live-ws');
ws.on('open', () => console.log('Connected to server websocket'));
ws.on('message', (data) => console.log('Message from server:', data.toString()));
ws.on('close', () => console.log('Closed'));
ws.on('error', (err) => console.error('Error:', err));
setTimeout(() => ws.close(), 5000);
