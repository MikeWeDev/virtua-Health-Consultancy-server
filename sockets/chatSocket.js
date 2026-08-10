module.exports = function initChatSocket(io) {
  io.on("connection", (socket) => {
    console.log(`[Chat Socket] Connected: ${socket.id}`);
    
    let currentRoom = null;

    socket.on("join", (roomId) => {
      if (currentRoom) {
        socket.leave(currentRoom);
        socket.to(currentRoom).emit("user-left", socket.id);
      }

      socket.join(roomId);
      currentRoom = roomId;
      console.log(`[Chat Socket] ${socket.id} joined ${roomId}`);
      socket.to(roomId).emit("user-joined", socket.id);
    });

    socket.on("leave", (roomId) => {
      if (!roomId || !currentRoom) return;
      if (roomId !== currentRoom) return;
      socket.leave(currentRoom);
      socket.to(currentRoom).emit("user-left", socket.id);
      currentRoom = null;
    });

    socket.on("signal", (msg) => {
      console.log(`[Chat Socket] Signal from ${socket.id} in ${currentRoom}:`, msg?.id);
      if (currentRoom) {
        socket.to(currentRoom).emit("signal", msg);
      } else {
        console.error(`[Chat Socket] ${socket.id} sent signal without joining room`);
      }
    });

    socket.on("disconnect", () => {
      console.log(`[Chat Socket] Disconnected: ${socket.id}`);
      if (currentRoom) {
        socket.to(currentRoom).emit("user-left", socket.id);
      }
    });
  });
};