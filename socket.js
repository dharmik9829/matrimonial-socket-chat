const express = require("express");
const http = require("http");
const socketIo = require("socket.io");
const app = express();
const cors = require("cors");
const moment = require("moment");

// FUNCTIONS
function notifyOnlineUsers(roomId) {
  const onlineUsersInRoom = [];
  for (const [userId, socket] of userSocketMap) {
    if (userId.includes(roomId)) {
      let finalUser = userId.replace(roomId + "---", "");
      onlineUsersInRoom.push(Number(finalUser));
    }
  }
  io.to(roomId).emit("GET_ALL_ONLINE_USERS", onlineUsersInRoom);
}

// const corsOptions = {
//   origin: '*', // Allow all origins
//   methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
//   allowedHeaders: ['Content-Type', 'Authorization']
// };

// app.use(cors(corsOptions));

const server = http.createServer();

// Set up Socket.io
const io = socketIo(server, {
  cors: {
    origin: "*",
  },
});

function getCurrentTimeFormatted() {
  const now = new Date();

  // Define options for formatting the date and time in Asia/Kolkata time zone
  const options = {
    timeZone: "Asia/Kolkata",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false, // Use 24-hour format
  };

  // Format the date and time according to the Asia/Kolkata time zone
  const formatter = new Intl.DateTimeFormat("en-GB", options);

  // Format the date and time parts separately
  const parts = formatter.formatToParts(now);

  // Extract date and time components
  const day = parts.find((p) => p.type === "day").value;
  const month = parts.find((p) => p.type === "month").value;
  const year = parts.find((p) => p.type === "year").value;
  const hour = parts.find((p) => p.type === "hour").value;
  const minute = parts.find((p) => p.type === "minute").value;
  const second = parts.find((p) => p.type === "second").value;

  // Construct the final formatted string
  return `${year}-${month}-${day} ${hour}:${minute}:${second}`;
}

const roomIds = new Set();
// Create a Map to track user IDs and their socket IDs
const userSocketMap = new Map();

// Middleware to authenticate and associate user IDs
io.use((socket, next) => {
  const userId = socket.handshake.auth.userId;
  const username = socket.handshake.auth.username;
  const roomId = socket.handshake.auth.roomId;
  if (userId && username && roomId) {
    socket.userId = userId;
    socket.username = username;
    socket.roomId = roomId;
    next();
  } else {
    next(new Error("Authentication error"));
  }
});

io.on("connection", async (socket) => {
  try {
    userSocketMap.set(socket.userId, socket.id);

    socket.join(socket.roomId);
    if (!roomIds.has(socket.roomId)) {
      roomIds.add(socket.roomId);
    }

    socket.on("GET_ALL_ONLINE_USERS_REQUEST", function () {
      notifyOnlineUsers(socket.roomId);
    });

    socket.on("READ_SUCCESS", async ({ senderId, messageId }) => {
      const senderSocket = userSocketMap.get(senderId);
      if (senderSocket) {
        io.to(senderSocket).emit("UPDATE_MESSAGE_STATUS", {
          sender: senderId,
          messageId,
          status: "seen",
        });
      }
    });
    // Handle sending messages
    socket.on("SEND_MESSAGE", async ({ receiverId, message, messageId }) => {
      const receiverSocketId = userSocketMap.get(receiverId);
      if (receiverSocketId) {
        // const now = moment();
        // const formattedDate = now.format("D MMMM YYYY hh:mm A");
        console.log(socket.userId);
        io.to(receiverSocketId).emit("receive_message", {
          message,
          messageId,
          sender: socket.userId,
          username: socket.username,
          time: getCurrentTimeFormatted(),
        });
      } else {
        socket.emit("UPDATE_MESSAGE_STATUS", {
          sender: socket.userId,
          messageId,
          status: "unread",
        });
      }
    });

    // Handle disconnection
    socket.on("disconnect", () => {
      userSocketMap.delete(socket.userId);
      console.log("User Disconnected");
      console.log("socket room id " + socket.roomId);
      socket.leave(socket.roomId);
      notifyOnlineUsers(socket.roomId);
    });
  } catch (error) {
    console.error("Error handling connection:", error);
  }
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
