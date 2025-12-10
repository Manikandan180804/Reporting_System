let io = null;

module.exports = {
  init: function(server) {
    try {
      const { Server } = require('socket.io');
      io = new Server(server, {
        cors: {
          origin: '*',
        },
      });
      io.on('connection', (socket) => {
        console.log('Socket connected:', socket.id);
        socket.on('disconnect', () => console.log('Socket disconnected:', socket.id));
      });
      return io;
    } catch (err) {
      console.warn('socket.io not available. Real-time features disabled.');
      return null;
    }
  },
  getIO: function() {
    return io;
  }
};
