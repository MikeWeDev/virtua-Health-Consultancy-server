module.exports = function initVideoSocket(io) {
  io.on("connection", (socket) => {
    console.log("🟢 [Video Socket] Connected:", socket.id);

    socket.on("join", async (roomId) => {
      console.log(`👤 [Video Socket] ${socket.id} joined room: ${roomId}`);
      socket.data.roomId = roomId;
      socket.join(roomId);

      const clients = await io.in(roomId).allSockets();

      if (clients.size === 1) {
        console.log(`🧭 [Video Socket] ${socket.id} is initiator`);
        socket.emit("you-are-initiator");
      } else {
        console.log(`📨 [Video Socket] Notifying room ${roomId} of new join`);
        socket.to(roomId).emit("user-joined");
      }

      socket.on("webrtc-signal", (data) => {
        socket.to(roomId).emit("webrtc-signal", data);
      });

      socket.on("leave", () => {
        console.log(`👋 [Video Socket] ${socket.id} left room: ${roomId}`);
        socket.leave(roomId);
        socket.to(roomId).emit("user-left");
      });

      socket.on("disconnect", () => {
        console.log(`🔴 [Video Socket] ${socket.id} disconnected from room: ${roomId}`);
        socket.to(roomId).emit("user-left");
      });
    });
  });
};