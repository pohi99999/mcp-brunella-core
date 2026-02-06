import { pipeline, env } from '@xenova/transformers';

// Adatvédelmi beállítás: Ne töltsön le távoli modelleket, ha már van helyi
env.allowLocalModels = true;

// Singleton minta a pipeline-hoz, hogy ne töltsük be minden üzenetnél újra
class SpeechRecognitionPipeline {
  static task = 'automatic-speech-recognition';
  static model = 'Xenova/whisper-tiny';
  static instance = null;

  static async getInstance(progress_callback = null) {
    if (this.instance === null) {
      this.instance = await pipeline(this.task, this.model, { progress_callback });
    }
    return this.instance;
  }
}

// Figyeljük a fő száltól érkező üzeneteket
self.addEventListener('message', async (event) => {
  try {
    const transcriber = await SpeechRecognitionPipeline.getInstance((data) => {
      // Modell letöltési állapotának visszaküldése a UI-nak
      self.postMessage({ status: 'loading', data });
    });

    // A tényleges, erőforrás-igényes inferencia futtatása
    const output = await transcriber(event.data.audio);

    // Eredmény visszaküldése
    self.postMessage({ status: 'complete', output });

  } catch (error) {
    self.postMessage({ status: 'error', error: error.message });
  }
});