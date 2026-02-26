import { Router } from "express";
import { exec } from "child_process";
import path from "path";
import fs from "fs";
import { fileURLToPath } from "url";
import { logInfo, logError } from "../../utils/logger.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const router = Router();

const TEMP_AUDIO_DIR = path.join(process.cwd(), "public", "audio");
if (!fs.existsSync(TEMP_AUDIO_DIR)) {
  fs.mkdirSync(TEMP_AUDIO_DIR, { recursive: true });
}

router.post("/tts", async (req, res) => {
  const { text } = req.body;
  if (!text) return res.status(400).json({ error: "Text is required" });

  const fileName = `tts_${Date.now()}.mp3`;
  const filePath = path.join(TEMP_AUDIO_DIR, fileName);
  const scriptPath = path.join(process.cwd(), "myai", "utils", "tts_engine.py");

  // Call Python script
  const command = `python "${scriptPath}" "${text.replace(/"/g, "'")}" "${filePath}"`;
  
  exec(command, (error, stdout, stderr) => {
    if (error) {
      logError("VoiceRoute", `TTS Error: ${error.message}`);
      return res.status(500).json({ error: "TTS Generation failed" });
    }
    logInfo("VoiceRoute", `TTS Generated: ${fileName}`);
    res.json({ url: `/audio/${fileName}` });
  });
});

export default router;
