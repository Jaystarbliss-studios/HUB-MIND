import WebSocket from 'ws';
const ws = new WebSocket('ws://localhost:3000/api/live-ws');
ws.on('open', () => console.log('Connected'));
ws.on('message', (data) => console.log('Message:', data.toString()));
setTimeout(() => ws.close(), 3000);
