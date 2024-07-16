const WebSocket = require("ws");
const express = require("express");
const http = require("http");
const cors = require("cors"); // Add this line

const HOST = "0.0.0.0";
const WS_PORT = 8081;
const HTTP_PORT = 8091;

const app = express();
app.use(cors()); // Add this line

const server = http.createServer(app);
const wss = new WebSocket.Server({ server });

console.log(`Other aircraft service running on ws://${HOST}:${WS_PORT}`);

// Host aircraft initial position
let hostLatitude = 36.8529;
let hostLongitude = -76.9214;

let aircraft = [];

function generateAircraft() {
  aircraft = Array.from({ length: 50 }, (_, i) => ({
    id: `AC${i + 1}`,
    latitude: hostLatitude + (Math.random() - 0.5) * 12, // Roughly within 400 miles
    longitude: hostLongitude + (Math.random() - 0.5) * 12,
    altitude: Math.floor(Math.random() * 35000) + 5000, // 5000 to 40000 feet
    speed: Math.floor(Math.random() * 200) + 250, // 250 to 450 knots
    heading: Math.floor(Math.random() * 360), // 0 to 359 degrees
  }));
}

generateAircraft();

function updateAircraftPositions() {
  aircraft.forEach((ac) => {
    // Convert speed from knots to degrees per second
    const speedDegPerSec = ac.speed / 3600 / 60;

    // Update position based on heading
    ac.latitude +=
      speedDegPerSec * Math.cos(((ac.heading - 90) * Math.PI) / 180);
    ac.longitude +=
      speedDegPerSec * Math.sin(((ac.heading - 90) * Math.PI) / 180);

    // Randomly change heading occasionally
    if (Math.random() < 0.05) {
      // 5% chance each update
      ac.heading =
        (ac.heading + Math.floor(Math.random() * 60) - 30 + 360) % 360;
    }
  });

  return aircraft;
}

wss.on("connection", (ws) => {
  console.log("Client connected");

  const intervalId = setInterval(() => {
    const data = updateAircraftPositions();
    ws.send(JSON.stringify(data));
  }, 1000); // 1 Hz update rate

  ws.on("close", () => {
    console.log("Client disconnected");
    clearInterval(intervalId);
  });
});

// Reset endpoint
app.options("/reset", cors()); // Enable pre-flight request for POST request
app.post("/reset", (req, res) => {
  generateAircraft();
  res.json({ message: "Other aircraft positions reset" });
});

server.listen(WS_PORT, HOST);
app.listen(HTTP_PORT, HOST, () => {
  console.log(`HTTP server running on http://${HOST}:${HTTP_PORT}`);
});
