# FILE: myai/incubator/train.py
# PURPOSE: Unsloth alapú QLoRA tréner RTX 3060 (12GB VRAM) hardverre.

from unsloth import FastLanguageModel
import torch
from trl import SFTTrainer
from transformers import TrainingArguments
from datasets import load_dataset

def run_training():
    max_seq_length = 2048
    model_name = "unsloth/llama-3.1-8b-bnb-4bit"

    model, tokenizer = FastLanguageModel.from_pretrained(
        model_name = model_name,
        max_seq_length = max_seq_length,
        load_in_4bit = True,
    )

    model = FastLanguageModel.get_peft_model(
        model,
        r = 16,
        target_modules = ["q_proj", "k_proj", "v_proj", "o_proj"],
        lora_alpha = 16,
        lora_dropout = 0,
        bias = "none",
    )

    dataset = load_dataset("json", data_files="data/training/golden_dataset.jsonl", split="train")

    trainer = SFTTrainer(
        model = model,
        tokenizer = tokenizer,
        train_dataset = dataset,
        dataset_text_field = "messages", # ChatML kezelés
        max_seq_length = max_seq_length,
        args = TrainingArguments(
            per_device_train_batch_size = 2,
            gradient_accumulation_steps = 4,
            warmup_steps = 5,
            max_steps = 60,
            learning_rate = 2e-4,
            fp16 = not torch.cuda.is_bf16_supported(),
            bf16 = torch.cuda.is_bf16_supported(),
            logging_steps = 1,
            output_dir = "outputs",
        ),
    )

    trainer.train()
    
    # GGUF export az Ollama-hoz
    model.save_pretrained_gguf("model_output", tokenizer, quantization_method = "q4_k_m")

# Kompatibilitás: régi függvény név
def train_model():
    print("Starting nightly training...")
    run_training()
    print("Training complete.")

if __name__ == "__main__":
    run_training()