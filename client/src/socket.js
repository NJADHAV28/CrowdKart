import { io } from 'socket.io-client';
import { serverUrl, getToken } from './api.js';

let socket = null;

export function getSocket() {
  const token = getToken();
  if (!token) return null;
  if (socket && socket.auth?.token === token) return socket;
  socket?.disconnect();
  socket = io(serverUrl() || undefined, { auth: { token }, transports: ['websocket', 'polling'] });
  return socket;
}

export function closeSocket() {
  socket?.disconnect();
  socket = null;
}
