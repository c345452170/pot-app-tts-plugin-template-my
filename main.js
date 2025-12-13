const EDGE_TTS_ENDPOINT = "https://speech.platform.bing.com/consumer/speech/synthesize/readaloud/edge/v1?TrustedClientToken=6sRZT9jSki0qxSg4Wvrh1fFd7U8vnbpZ";

function escapeSsml(text) {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/\"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

async function tts(text, lang, options = {}) {
  const { utils, config = {} } = options;
  const { tauriFetch } = utils;

  const voiceName = config.voiceName || "en-US-AriaNeural";
  const locale = (lang || "en").replace("_", "-") || "en-US";

  const ssml = `<?xml version='1.0' encoding='UTF-8'?>\n<speak version='1.0' xml:lang='${locale}'>\n  <voice name='${voiceName}'>${escapeSsml(text)}</voice>\n</speak>`;

  const response = await tauriFetch(EDGE_TTS_ENDPOINT, {
    method: "POST",
    headers: {
      "Content-Type": "application/ssml+xml",
      "X-Microsoft-OutputFormat": "audio-24khz-48kbitrate-mono-mp3",
      "User-Agent":
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
      Accept: "*/*",
      Origin: "https://edge.microsoft.com",
      Referer: "https://edge.microsoft.com/"
    },
    body: ssml,
    responseType: "binary"
  });

  if (!response.ok) {
    throw `Edge TTS request failed\\nHttp Status: ${response.status}\\n${JSON.stringify(response.data)}`;
  }

  return response.data;
}
