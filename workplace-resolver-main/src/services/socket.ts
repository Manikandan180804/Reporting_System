// Lightweight Socket.IO client scaffold.
// This tries to dynamically import `socket.io-client` if available.
// If not installed, the functions become no-ops so the app continues to work.

let socket: any = null;

export async function connectSocket(namespace = '') {
  if (socket) return socket;
  try {
    const { io } = await import('socket.io-client');
    const url = (import.meta.env.VITE_API_WS_URL || (import.meta.env.VITE_API_URL || 'http://localhost:5000')) as string;
    socket = io(url + namespace, { transports: ['websocket'] });
    return socket;
  } catch (err) {
    // socket.io-client not installed or failed to load — fallback to noop
    console.warn('socket.io-client not available, real-time sockets disabled');
    socket = null;
    return null;
  }
}

export function on(event: string, handler: (...args: any[]) => void) {
  if (!socket) return () => {};
  socket.on(event, handler);
  return () => socket.off(event, handler);
}

export function emit(event: string, payload?: any) {
  if (!socket) return;
  socket.emit(event, payload);
}

export function disconnectSocket() {
  if (!socket) return;
  socket.disconnect();
  socket = null;
}

export default { connectSocket, on, emit, disconnectSocket };
