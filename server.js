import { createServer } from "http";
import next from "next";
import { Server } from "socket.io";

const port = parseInt(process.env.PORT || "3000", 10);
const dev = process.env.NODE_ENV !== "production";
const app = next({ dev });
const handle = app.getRequestHandler();

app.prepare().then(() => {
  const httpServer = createServer((req, res) => {
    handle(req, res);
  });

  const io = new Server(httpServer, {
    cors: { origin: "*" },
  });

  io.on("connection", (socket) => {
    console.log(`[Socket.io] Client connected: ${socket.id}`);

    // A new worry was created
    socket.on("worry:created", (worry) => {
      socket.broadcast.emit("worry:created", worry);
    });

    // A solution was added to a worry
    socket.on("solution:created", (data) => {
      // data: { worryId, solution }
      socket.broadcast.emit("solution:created", data);
    });

    // PacMan eating animation triggered
    socket.on("pacman:eating", (data) => {
      // data: { worryId, dbId }
      socket.broadcast.emit("pacman:eating", data);
    });

    // A worry was deleted (after pacman finishes)
    socket.on("worry:deleted", (data) => {
      // data: { worryId }
      socket.broadcast.emit("worry:deleted", data);
    });

    socket.on("disconnect", () => {
      console.log(`[Socket.io] Client disconnected: ${socket.id}`);
    });
  });

  httpServer.listen(port, () => {
    console.log(
      `> Server listening at http://localhost:${port} as ${
        dev ? "development" : process.env.NODE_ENV
      }`
    );
  });
});
