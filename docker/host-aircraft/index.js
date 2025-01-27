const WebSocket = require("ws");
const express = require("express");
const http = require("http");
const cors = require("cors");

const HOST = "0.0.0.0";
const WS_PORT = 8080;
const HTTP_PORT = 8090;

const app = express();
app.use(cors());
const server = http.createServer(app);
const wss = new WebSocket.Server({ server });

console.log(`Host aircraft service running on ws://${HOST}:${WS_PORT}`);

// Initial position (50 miles off the coast of Virginia)
let latitude = 36.8529;
let longitude = -76.9214;
const altitude = 25000; // feet
const speed = 300; // knots
let heading = 270; // degrees

// Turn rate: 180 degrees per minute = 3 degrees per second
const turnRate = 3;

function resetPosition() {
  latitude = 36.8529;
  longitude = -76.9214;
  heading = 270;
}

function updatePosition() {
  // Update heading (constant left turn)
  heading = (heading - turnRate / 10 + 360) % 360; // Divide by 10 because we update 10 times per second

  const speedDegPerSec = speed / 3600 / 60;
  const headingRad = (heading * Math.PI) / 180;

  latitude += speedDegPerSec * Math.cos(headingRad);
  longitude +=
    (speedDegPerSec * Math.sin(headingRad)) /
    Math.cos((latitude * Math.PI) / 180);

  // Ensure longitude wraps around correctly
  longitude = ((longitude + 180) % 360) - 180;

  return {
    latitude,
    longitude,
    altitude,
    speed,
    heading,
    timestamp: new Date().toISOString(),
  };
}

wss.on("connection", (ws) => {
  console.log("Client connected");

  const intervalId = setInterval(() => {
    const data = updatePosition();
    ws.send(JSON.stringify(data));
  }, 100); // 10 Hz update rate

  ws.on("close", () => {
    console.log("Client disconnected");
    clearInterval(intervalId);
  });
});

// Reset endpoint
app.options("/reset", cors());
app.post("/reset", (req, res) => {
  resetPosition();
  res.json({ message: "Host aircraft position reset" });
});

server.listen(WS_PORT, HOST);
app.listen(HTTP_PORT, HOST, () => {
  console.log(`HTTP server running on http://${HOST}:${HTTP_PORT}`);
});
