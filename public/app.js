const micButton =
  document.getElementById("micButton");

const screenButton =
  document.getElementById("screenButton");

const stopButton =
  document.getElementById("stopButton");

const status =
  document.getElementById("status");

const assistantState =
  document.getElementById("assistantState");

const assistantHint =
  document.getElementById("assistantHint");

const userText =
  document.getElementById("userText");

const floraText =
  document.getElementById("floraText");

const screenStatus =
  document.getElementById("screenStatus");

const voiceStatus =
  document.getElementById("voiceStatus");


let recognition = null;

let listening = false;

let screenStream = null;

let screenshot = null;

let conversation = [];


/* -------------------------
   VOICE RECOGNITION
------------------------- */

function createRecognition() {

  const SpeechRecognition =
    window.SpeechRecognition ||
    window.webkitSpeechRecognition;

  if (!SpeechRecognition) {

    speak(
      "Voice recognition is not supported in this browser. Please use Chrome."
    );

    return null;
  }


  const r =
    new SpeechRecognition();


  r.lang =
    navigator.language || "en-IN";

  r.interimResults =
    false;

  r.continuous =
    false;


  r.onstart = () => {

    listening = true;

    micButton.classList.add("active");

    status.textContent =
      "LISTENING";

    voiceStatus.textContent =
      "LISTENING";

    assistantState.textContent =
      "LISTENING";

    assistantHint.textContent =
      "I'm listening...";
  };


  r.onresult = async event => {

    const text =
      event.results[0][0].transcript.trim();


    userText.textContent =
      text;


    assistantState.textContent =
      "THINKING";


    assistantHint.textContent =
      "Processing...";


    await processCommand(text);
  };


  r.onerror = event => {

    console.error(event.error);

    assistantState.textContent =
      "FLORA";

    assistantHint.textContent =
      "Microphone error.";

    status.textContent =
      "READY";

    voiceStatus.textContent =
      "READY";
  };


  r.onend = () => {

    listening = false;

    micButton.classList.remove("active");

    status.textContent =
      "READY";

    voiceStatus.textContent =
      "READY";
  };


  return r;
}


/* -------------------------
   MICROPHONE
------------------------- */

micButton.onclick = () => {

  if (!recognition) {

    recognition =
      createRecognition();
  }


  if (!recognition) return;


  if (listening) {

    recognition.stop();

  } else {

    recognition.start();

  }
};


/* -------------------------
   SPEECH
------------------------- */

function speak(text) {

  floraText.textContent =
    text;


  if (!window.speechSynthesis)
    return;


  speechSynthesis.cancel();


  const speech =
    new SpeechSynthesisUtterance(text);


  speech.lang =
    navigator.language || "en-IN";


  speech.rate =
    0.95;


  speech.pitch =
    1;


  speech.onstart = () => {

    status.textContent =
      "SPEAKING";
  };


  speech.onend = () => {

    status.textContent =
      "READY";
  };


  speechSynthesis.speak(speech);
}


/* -------------------------
   SCREEN SHARING
------------------------- */

async function shareScreen() {

  if (!navigator.mediaDevices?.getDisplayMedia) {

    throw new Error(
      "Screen sharing is not supported by this browser."
    );
  }


  screenStream =
    await navigator.mediaDevices.getDisplayMedia({
      video: true,
      audio: false
    });


  const video =
    document.createElement("video");


  video.srcObject =
    screenStream;


  video.muted =
    true;


  await video.play();


  await new Promise(
    resolve => setTimeout(resolve, 300)
  );


  const canvas =
    document.createElement("canvas");


  const maxWidth =
    1280;


  const scale =
    Math.min(
      1,
      maxWidth / video.videoWidth
    );


  canvas.width =
    video.videoWidth * scale;


  canvas.height =
    video.videoHeight * scale;


  const ctx =
    canvas.getContext("2d");


  ctx.drawImage(
    video,
    0,
    0,
    canvas.width,
    canvas.height
  );


  screenshot =
    canvas.toDataURL(
      "image/jpeg",
      0.70
    );


  screenStatus.textContent =
    "ON";


  screenStream
    .getVideoTracks()[0]
    .addEventListener(
      "ended",
      () => {

        screenStream = null;

        screenshot = null;

        screenStatus.textContent =
          "OFF";
      }
    );
}


/* -------------------------
   SCREEN BUTTON
------------------------- */

screenButton.onclick =
  async () => {

    try {

      await shareScreen();

      speak(
        "Screen sharing is ready. Ask me what is on your screen."
      );

    } catch (error) {

      speak(error.message);
    }
  };


/* -------------------------
   STOP
------------------------- */

stopButton.onclick = () => {

  recognition?.stop();

  speechSynthesis?.cancel();

  status.textContent =
    "READY";

  voiceStatus.textContent =
    "READY";

  assistantState.textContent =
    "FLORA";

  assistantHint.textContent =
    "Press the microphone and talk to me.";
};


/* -------------------------
   ASK GEMINI
------------------------- */

// app.js
// Unified Voice Assistant backend — supports OpenAI, Gemini, Groq, and Claude (Anthropic)
//
// SETUP:
// 1. npm init -y
// 2. npm install express dotenv node-fetch cors
// 3. Create a ".env" file in the same folder and put your real API keys there.
//    NEVER commit .env or hardcode keys in this file.
// 4. node app.js

require("dotenv").config();
const express = require("express");
const cors = require("cors");
const fetch = require("node-fetch"); // Node < 18 needs this; Node 18+ has global fetch

const app = express();
app.use(cors());
app.use(express.json());

// ---------------------------------------------------------------------------
// API KEYS — loaded from environment variables (.env file), not hardcoded here
// ---------------------------------------------------------------------------
const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
const GROQ_API_KEY = process.env.GROQ_API_KEY;
const CLAUDE_API_KEY = process.env.CLAUDE_API_KEY; // Anthropic API key

// ---------------------------------------------------------------------------
// Provider handlers — each takes (message, history) and returns a text reply
// ---------------------------------------------------------------------------

async function callOpenAI(message, history = []) {
  const res = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${OPENAI_API_KEY}`,
    },
    body: JSON.stringify({
      model: "gpt-4o-mini",
      messages: [...history, { role: "user", content: message }],
    }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(`OpenAI error: ${JSON.stringify(data)}`);
  return data.choices[0].message.content;
}

async function callGroq(message, history = []) {
  const res = await fetch("https://api.groq.com/openai/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${GROQ_API_KEY}`,
    },
    body: JSON.stringify({
      model: "llama-3.3-70b-versatile",
      messages: [...history, { role: "user", content: message }],
    }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(`Groq error: ${JSON.stringify(data)}`);
  return data.choices[0].message.content;
}

async function callGemini(message, history = []) {
  // Gemini uses a different message shape: { role, parts: [{text}] }
  const contents = [
    ...history.map((h) => ({
      role: h.role === "assistant" ? "model" : "user",
      parts: [{ text: h.content }],
    })),
    { role: "user", parts: [{ text: message }] },
  ];

  const res = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${GEMINI_API_KEY}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ contents }),
    }
  );
  const data = await res.json();
  if (!res.ok) throw new Error(`Gemini error: ${JSON.stringify(data)}`);
  return data.candidates[0].content.parts[0].text;
}

async function callClaude(message, history = []) {
  // Anthropic Messages API — same role/content shape as OpenAI (user/assistant)
  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": CLAUDE_API_KEY,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({
      model: "claude-sonnet-4-6",
      max_tokens: 1024,
      messages: [...history, { role: "user", content: message }],
    }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(`Claude error: ${JSON.stringify(data)}`);
  // Claude's response content is an array of blocks; join any text blocks
  return data.content
    .filter((block) => block.type === "text")
    .map((block) => block.text)
    .join("\n");
}

// ---------------------------------------------------------------------------
// Router — pick provider dynamically
// ---------------------------------------------------------------------------
const PROVIDERS = {
  openai: callOpenAI,
  groq: callGroq,
  gemini: callGemini,
  claude: callClaude,
};

app.post("/chat", async (req, res) => {
  try {
    const { message, provider = "openai", history = [] } = req.body;

    if (!message) {
      return res.status(400).json({ error: "message is required" });
    }
    if (!PROVIDERS[provider]) {
      return res.status(400).json({
        error: `Unknown provider "${provider}". Choose from: ${Object.keys(PROVIDERS).join(", ")}`,
      });
    }

    const reply = await PROVIDERS[provider](message, history);
    res.json({ provider, reply });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

app.get("/", (req, res) => {
  res.send("Voice Assistant backend running. POST to /chat with { message, provider, history }.");
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Voice assistant server listening on http://localhost:${PORT}`);
});


/* -------------------------
   COMMAND PROCESSING
------------------------- */

async function processCommand(text) {

  const lower =
    text.toLowerCase();


  try {

    /* TIME */

    if (
      lower.includes("time") ||
      lower.includes("what time")
    ) {

      const now =
        new Date();


      const time =
        new Intl.DateTimeFormat(
          navigator.language || "en-IN",
          {
            hour: "numeric",
            minute: "2-digit",
            second: "2-digit"
          }
        ).format(now);


      speak(
        `The current time is ${time}.`
      );

      return;
    }


    /* DATE */

    if (
      lower.includes("date") ||
      lower.includes("what day")
    ) {

      const now =
        new Date();


      const date =
        new Intl.DateTimeFormat(
          navigator.language || "en-IN",
          {
            weekday: "long",
            year: "numeric",
            month: "long",
            day: "numeric"
          }
        ).format(now);


      speak(
        `Today is ${date}.`
      );

      return;
    }


    /* YOUTUBE */

    if (
      lower.includes("open youtube") ||
      lower.includes("go to youtube")
    ) {

      window.location.href =
        "https://www.youtube.com/";

      return;
    }


    /* INSTAGRAM */

    if (
      lower.includes("open instagram")
    ) {

      window.location.href =
        "https://www.instagram.com/";

      return;
    }


    /* WIKIPEDIA */

    if (
      lower.includes("open wikipedia")
    ) {

      window.location.href =
        "https://www.wikipedia.org/";

      return;
    }


    /* CHATGPT */

    if (
      lower.includes("open chatgpt") ||
      lower.includes("open chat gpt")
    ) {

      window.location.href =
        "https://chatgpt.com/";

      return;
    }


    /* DISCORD */

    if (
      lower.includes("open discord")
    ) {

      window.location.href =
        "https://discord.com/app";

      return;
    }


    /* SCREEN */

    if (
      lower.includes("screen") &&
      (
        lower.includes("see") ||
        lower.includes("look") ||
        lower.includes("what") ||
        lower.includes("read")
      )
    ) {

      if (!screenshot) {

        await shareScreen();
      }


      await askGemini(
        "Describe everything important visible on my screen. " +
        "This is for a blind or low-vision user. " +
        "Read important text and explain useful buttons, " +
        "menus, windows, errors and navigation clues.",
        true
      );

      return;
    }


    /* NORMAL AI */

    await askGemini(text);

  } catch (error) {

    console.error(error);

    speak(
      error.message ||
      "Something went wrong."
    );
  }
}


/* -------------------------
   QUICK BUTTONS
------------------------- */

document
  .querySelectorAll(
    ".quick-actions button"
  )
  .forEach(button => {

    button.onclick =
      async () => {

        const command =
          button.dataset.command;

        const site =
          button.dataset.site;


        if (site) {

          window.location.href =
            site;

          return;
        }


        if (command) {

          userText.textContent =
            command;

          await processCommand(
            command
          );
        }
      };
  });
