require("dotenv").config(); // must be at top
const express = require("express");
const { Client, LocalAuth } = require("whatsapp-web.js");
const qrcode = require("qrcode-terminal");

const app = express();
app.use(express.json());

// Initialize WhatsApp client
const client = new Client({
  authStrategy: new LocalAuth(),
  puppeteer: {
    headless: true,
    args: [
      "--no-sandbox",
      "--disable-setuid-sandbox"
    ],
  },
});

let isReady = false;

// Helper to wait until client is ready
const waitForReady = () =>
  new Promise((resolve) => {
    if (isReady) return resolve();
    client.once("ready", () => {
      console.log("WhatsApp client now ready!");
      resolve();
    });
  });

// Listen for QR code (first-time login)
client.on("qr", (qr) => {
  console.log("QR code received, scan it with your WhatsApp:");
  qrcode.generate(qr, { small: true }); // terminal QR code
});

// Listen for ready event
client.on("ready", () => {
  console.log("WhatsApp ready!");
  isReady = true;
});

// Listen for authentication failure
client.on("auth_failure", (msg) => {
  console.error("Authentication failure:", msg);
});

// Initialize the client
client.initialize();

// Middleware to check Authorization key
app.use((req, res, next) => {
  const token = req.headers.authorization;
  console.log("NODE KEY:", process.env.WHATSAPP_API_KEY);
  if (token !== process.env.WHATSAPP_API_KEY) {
    return res.status(403).json({ error: "Unauthorized" });
  }
  next();
});

// Send message endpoint
app.post("/send", async (req, res) => {
  const { number, message } = req.body;

  if (!number || !message) {
    return res.status(400).json({ error: "number and message are required" });
  }

  try {
    // Wait until client is ready
    await waitForReady();

    const chatId = number + "@c.us";
    const chat = await client.getChatById(chatId).catch(() => null);

    if (!chat) {
      return res
        .status(404)
        .json({ error: "Chat not found. Send a message manually first." });
    }

    await client.sendMessage(chatId, message);
    res.json({ status: "success" });
  } catch (err) {
    console.error("SendMessage error:", err);
    res.status(500).json({ error: err.message || "Failed to send message" });
  }
});

// Start server
app.listen(3000, () => {
  console.log("Server running at http://localhost:3000");
});
