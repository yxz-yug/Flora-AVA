import express from "express";
import path from "path";
import { fileURLToPath } from "url";
import { GoogleGenAI } from "@google/genai";

const app = express();

const PORT = process.env.PORT || 10000;

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const publicPath = path.join(__dirname, "public");

const ai = new GoogleGenAI({
  apiKey: process.env.GEMINI_API_KEY
});

app.use(express.json({ limit: "15mb" }));

// Serve FLORA's website
app.use(express.static(publicPath));

// Homepage
app.get("/", (req, res) => {
  res.sendFile(path.join(publicPath, "index.html"));
});

// Test endpoint
app.get("/api/health", (req, res) => {
  res.json({
    status: "online",
    assistant: "FLORA"
  });
});

// AI endpoint
app.post("/api/ask", async (req, res) => {

  try {

    const {
      message,
      screenshot
    } = req.body;

    if (!message) {
      return res.status(400).json({
        error: "No message provided."
      });
    }

    let contents = [
      {
        role: "user",
        parts: [
          {
            text: `
You are FLORA, a voice assistant designed to help
blind and low-vision users.

Answer naturally and clearly.

If a screenshot is provided, describe the important
things visible on the screen, including text,
buttons, menus, errors and useful navigation clues.

User request:
${message}
`
          }
        ]
      }
    ];

    if (screenshot) {

      const base64Image =
        screenshot.replace(
          /^data:image\/\w+;base64,/,
          ""
        );

      contents[0].parts.push({
        inlineData: {
          mimeType: "image/jpeg",
          data: base64Image
        }
      });
    }

    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash",
      contents
    });

    res.json({
      answer: response.text || "I couldn't generate an answer."
    });

  } catch (error) {

    console.error("FLORA ERROR:", error);

    res.status(500).json({
      error: error.message || "AI request failed."
    });

  }

});

app.listen(PORT, "0.0.0.0", () => {

  console.log(
    `FLORA is running on port ${PORT}`
  );

});
