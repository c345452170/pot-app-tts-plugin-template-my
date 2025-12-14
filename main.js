const DEFAULT_TTS_ENDPOINT = "https://tts.wangwangit.com/v1/audio/speech";
const DEFAULT_VOICE = "zh-CN-XiaoxiaoNeural";
const DEFAULT_STYLE = "general";
const DEFAULT_SPEED = 1.0;
const DEFAULT_PITCH = "0";

function normalizeNumber(value, fallback) {
  const parsed = typeof value === "number" ? value : parseFloat(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function escapeJsonText(text) {
  return text.replace(/\\/g, "\\\\").replace(/\r?\n/g, "\n");
}

async function tts(text, lang, options = {}) {
  const { utils, config = {} } = options;
  const { http } = utils;
  const { fetch, Body, ResponseType } = http;

  const endpoint = (config.requestPath || DEFAULT_TTS_ENDPOINT).trim() || DEFAULT_TTS_ENDPOINT;
  const voice = config.voice || DEFAULT_VOICE;
  const speed = normalizeNumber(config.speed, DEFAULT_SPEED);
  const pitch = typeof config.pitch === "string" || typeof config.pitch === "number" ? `${config.pitch}` : DEFAULT_PITCH;
  const style = config.style || DEFAULT_STYLE;

  const payload = {
    input: escapeJsonText(text),
    voice,
    speed,
    pitch,
    style
  };

  const response = await fetch(endpoint, {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: Body.json(payload),
    responseType: ResponseType.Binary
  });

  if (!response.ok) {
    let errorMessage = `TTS request failed with status ${response.status}`;
    try {
      const textDecoder = new TextDecoder();
      errorMessage += `: ${textDecoder.decode(new Uint8Array(response.data))}`;
    } catch (error) {
      // ignore decode errors, fallback to status message only
    }
    throw new Error(errorMessage);
  }

  return new Uint8Array(response.data);
}

module.exports = { tts };
