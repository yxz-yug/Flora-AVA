import express from "express";
import path from "path";
import { fileURLToPath } from "url";

import { GoogleGenAI } from "@google/genai";
import OpenAI from "openai";

const app = express();

const PORT = process.env.PORT || 10000;


/* =========================================================
   PATHS
========================================================= */

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const publicPath = path.join(__dirname, "public");


/* =========================================================
   AI CLIENTS
========================================================= */

const gemini = process.env.GEMINI_API_KEY
  ? new GoogleGenAI({
      apiKey: process.env.GEMINI_API_KEY
    })
  : null;


const openai = process.env.OPENAI_API_KEY
  ? new OpenAI({
      apiKey: process.env.OPENAI_API_KEY
    })
  : null;


/*
   Groq uses an OpenAI-compatible API.
*/

const groq = process.env.GROQ_API_KEY
  ? new OpenAI({
      apiKey: process.env.GROQ_API_KEY,

      baseURL: "https://api.groq.com/openai/v1"
    })
  : null;


/* =========================================================
   CONFIGURATION
========================================================= */

const GEMINI_MODEL =
  process.env.GEMINI_MODEL || "gemini-3.7-flash";

const OPENAI_MODEL =
  process.env.OPENAI_MODEL || "gpt-5-mini";

const GROQ_MODEL =
  process.env.GROQ_MODEL || "llama-4-scout-17b-16e-instruct";


/* =========================================================
   EXPRESS
========================================================= */

app.use(
  express.json({
    limit: "15mb"
  })
);

app.use(express.static(publicPath));


app.get("/", (req, res) => {

  res.sendFile(
    path.join(publicPath, "index.html")
  );

});


/* =========================================================
   FLORA SYSTEM PROMPT
========================================================= */

const SYSTEM_PROMPT = `
You are FLORA.

FLORA is an AI accessibility assistant designed
to help blind and low-vision users interact with
computers more independently.

Your personality:

- Friendly
- Calm
- Intelligent
- Helpful
- Natural
- Clear

Because your responses may be spoken aloud:

- Avoid unnecessary long answers.
- Use simple language when possible.
- Clearly describe important information.
- Never claim to have performed an action if you did not.
- Never invent information.

When analyzing screenshots:

1. Describe the most important thing first.
2. Read important visible text.
3. Identify buttons and controls.
4. Explain navigation clues.
5. Mention errors or warnings.
6. Do not overwhelm the user with irrelevant visual details.

You are part of a multi-AI system.
The server decides which AI model should handle
each task.
`;


/* =========================================================
   ROUTER
========================================================= */

function chooseProvider(message, hasScreenshot) {

  const text =
    message.toLowerCase();


  /*
     SCREEN / VISION
  */

  if (hasScreenshot) {

    return "gemini";

  }


  /*
     CURRENT INFORMATION
  */

  const currentWords = [

    "latest",
    "today",
    "current",
    "right now",
    "news",
    "recent",
    "what happened",
    "weather"

  ];


  if (
    currentWords.some(
      word => text.includes(word)
    )
  ) {

    return "gemini";

  }


  /*
     COMPLEX REASONING
  */

  const reasoningWords = [

    "explain",
    "analyze",
    "compare",
    "why",
    "how does",
    "debug",
    "programming",
    "code",
    "math",
    "solve"

  ];


  if (
    reasoningWords.some(
      word => text.includes(word)
    )
  ) {

    return "openai";

  }


  /*
     EVERYTHING ELSE
     → fast provider
  */

  return "groq";

}


/* =========================================================
   GEMINI
========================================================= */

async function askGemini(
  message,
  screenshot
) {

  if (!gemini) {

    throw new Error(
      "Gemini API key is not configured."
    );

  }


  const parts = [

    {
      text:
        `${SYSTEM_PROMPT}\n\nUSER:\n${message}`
    }

  ];


  if (screenshot) {

    const base64 =
      screenshot.replace(
        /^data:image\/\w+;base64,/,
        ""
      );


    parts.push({

      inlineData: {

        mimeType:
          "image/jpeg",

        data:
          base64

      }

    });

  }


  const response =
    await gemini.models.generateContent({

      model:
        GEMINI_MODEL,

      contents: [

        {
          role: "user",

          parts

        }

      ]

    });


  return (
    response.text ||
    "I couldn't generate an answer."
  );

}


/* =========================================================
   OPENAI
========================================================= */

async function askOpenAI(
  message
) {

  if (!openai) {

    throw new Error(
      "OpenAI API key is not configured."
    );

  }


  const response =
    await openai.responses.create({

      model:
        OPENAI_MODEL,

      instructions:
        SYSTEM_PROMPT,

      input:
        message

    });


  return (
    response.output_text ||
    "I couldn't generate an answer."
  );

}


/* =========================================================
   GROQ
========================================================= */

async function askGroq(
  message
) {

  if (!groq) {

    throw new Error(
      "Groq API key is not configured."
    );

  }


  const response =
    await groq.chat.completions.create({

      model:
        GROQ_MODEL,

      messages: [

        {
          role:
            "system",

          content:
            SYSTEM_PROMPT

        },

        {

          role:
            "user",

          content:
            message

        }

      ],

      temperature:
        0.7

    });


  return (
    response.choices?.[0]?.message?.content ||
    "I couldn't generate an answer."
  );

}


/* =========================================================
   PROVIDER CALLER
========================================================= */

async function callProvider(
  provider,
  message,
  screenshot
) {

  if (provider === "gemini") {

    return await askGemini(
      message,
      screenshot
    );

  }


  if (provider === "openai") {

    return await askOpenAI(
      message
    );

  }


  if (provider === "groq") {

    return await askGroq(
      message
    );

  }


  throw new Error(
    "Unknown AI provider."
  );

}


/* =========================================================
   FALLBACK SYSTEM
========================================================= */

async function askWithFallback(
  preferredProvider,
  message,
  screenshot
) {

  const providers = [

    preferredProvider,

    "gemini",
    "openai",
    "groq"

  ];


  /*
     Remove duplicates.
  */

  const uniqueProviders =
    [...new Set(providers)];


  let lastError = null;


  for (
    const provider
    of uniqueProviders
  ) {

    try {

      console.log(
        `FLORA → trying ${provider}`
      );


      const answer =
        await callProvider(
          provider,
          message,
          screenshot
        );


      return {

        answer,

        provider

      };


    } catch (error) {

      console.error(
        `${provider} failed:`,
        error.message
      );


      lastError =
        error;

    }

  }


  throw (
    lastError ||
    new Error(
      "All AI providers failed."
    )
  );

}


/* =========================================================
   API
========================================================= */

app.post(
  "/api/ask",
  async (req, res) => {

    try {

      const {

        message,

        screenshot = null

      } = req.body;


      if (!message) {

        return res.status(400).json({

          error:
            "No message provided."

        });

      }


      /*
         Decide which AI should handle it.
      */

      const preferred =
        chooseProvider(
          message,
          Boolean(screenshot)
        );


      console.log(
        `FLORA ROUTER → ${preferred}`
      );


      /*
         Ask preferred AI.
         Automatically fallback if it fails.
      */

      const result =
        await askWithFallback(

          preferred,

          message,

          screenshot

        );


      res.json({

        answer:
          result.answer,

        provider:
          result.provider

      });


    } catch (error) {

      console.error(
        "FLORA ERROR:",
        error
      );


      res.status(500).json({

        error:
          "FLORA could not reach any AI provider."

      });

    }

  }
);


/* =========================================================
   HEALTH CHECK
========================================================= */

app.get(
  "/api/health",
  (req, res) => {

    res.json({

      status:
        "online",

      assistant:
        "FLORA 2.0",

      providers: {

        gemini:
          Boolean(gemini),

        openai:
          Boolean(openai),

        groq:
          Boolean(groq)

      }

    });

  }
);


/* =========================================================
   START SERVER
========================================================= */

app.listen(
  PORT,
  "0.0.0.0",
  () => {

    console.log(
      `FLORA 2.0 running on port ${PORT}`
    );

  }
);
