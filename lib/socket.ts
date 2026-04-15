"use client";

import { io, Socket } from "socket.io-client";

let socket: Socket | null = null;

export function getSocket(): Socket {
  if (!socket) {
    socket = io({
      // Connect to the same origin (custom server)
      transports: ["websocket", "polling"],
    });
  }
  return socket;
}
