import express from "express";
import path from "path";
import { fileURLToPath } from "url";
import Anthropic from "@anthropic-ai/sdk";

const app = express();

const PORT = process.env.PORT || 10000;

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const publicPath = path.join(__dirname, "public");


/* =========================================================
   CLAUDE
========================================================= */

const anthropic = process.env.CLAUDE_API_KEY
  ? new Anthropic({
      apiKey: process.env.CLAUDE_API_KEY
    })
  : null;


/*
   Keep the model configurable from Render.
*/

const CLAUDE_MODEL =
  process.env.CLAUDE_MODEL || "claude-opus-5";


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
   FLORA PERSONALITY
========================================================= */

const SYSTEM_PROMPT = `
You are FLORA.

FLORA is an AI accessibility assistant designed
to help blind and low-vision users interact with
computers more independently.

Your personality:

- Friendly
- Calm
- Helpful
- Intelligent
- Natural
- Patient

Your responses may be spoken aloud.

Therefore:

- Keep normal answers reasonably concise.
- Use clear language.
- Avoid unnecessary formatting.
- Never claim that you performed an action
  unless you actually performed it.
- Never invent information.

When the user asks a normal question,
answer naturally like a helpful voice assistant.

When the user provides a screenshot:

1. Explain what is most important first.
2. Identify visible text.
3. Identify important buttons and controls.
4. Explain useful navigation information.
5. Mention errors or warnings.
6. Do not overwhelm the user with irrelevant details.

You are FLORA, an accessibility-focused AI assistant.
`;


/* =========================================================
   ASK CLAUDE
========================================================= */

async function askClaude(
  message,
  screenshot = null
) {

  if (!anthropic) {

    throw new Error(
      "Claude API key is not configured."
    );

  }


  const content = [];


  /*
     Add screenshot if supplied.
  */

  if (screenshot) {

    const match =
      screenshot.match(
        /^data:(image\/[a-zA-Z0-9.+-]+);base64,(.+)$/
      );


    if (match) {

      const mimeType =
        match[1];

      const base64Data =
        match[2];


      content.push({

        type: "image",

        source: {

          type: "base64",

          media_type:
            mimeType,

          data:
            base64Data

        }

      });

    }

  }


  /*
     Add user message.
  */

  content.push({

    type: "text",

    text:
      message

  });


  const response =
    await anthropic.messages.create({

      model:
        CLAUDE_MODEL,

      max_tokens:
        2048,

      system:
        SYSTEM_PROMPT,

      messages: [

        {

          role:
            "user",

          content

        }

      ]

    });


  /*
     Claude can return multiple content blocks.
     We only collect text blocks.
  */

  const answer =
    response.content

      .filter(
        block =>
          block.type === "text"
      )

      .map(
        block =>
          block.text
      )

      .join("\n");


  if (!answer) {

    throw new Error(
      "Claude returned an empty response."
    );

  }


  return answer;

}


/* =========================================================
   FLORA API
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


      console.log(
        "FLORA → Claude"
      );


      const answer =
        await askClaude(
          message,
          screenshot
        );


      res.json({

        answer,

        provider:
          "claude"

      });


    } catch (error) {

      console.error(
        "CLAUDE ERROR:",
        error
      );


      res.status(500).json({

        error:
          error.message ||
          "FLORA could not reach Claude."

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
        "FLORA - Claude Edition",

      claude:
        Boolean(anthropic)

    });

  }
);


/* =========================================================
   START
========================================================= */

app.listen(
  PORT,
  "0.0.0.0",
  () => {

    console.log(
      `FLORA Claude Edition running on port ${PORT}`
    );

  }
);
