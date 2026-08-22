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

async function askGemini(
  message,
  includeScreen = false
) {

  status.textContent =
    "THINKING";


  const response =
    await fetch("/api/ask", {

      method: "POST",

      headers: {
        "Content-Type":
          "application/json"
      },

      body: JSON.stringify({

        message,

        history:
          conversation,

        screenshot:
          includeScreen
            ? screenshot
            : null
      })
    });


  const data =
    await response.json();


  if (!response.ok) {

    throw new Error(
      data.error ||
      "Gemini request failed."
    );
  }


  conversation.push({
    role: "user",
    content: message
  });


  conversation.push({
    role: "assistant",
    content: data.answer
  });


  conversation =
    conversation.slice(-12);


  speak(data.answer);
}


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
