#!/usr/bin/env python3
"""
Brunella Incubator - Unsloth Fine-tuning Motor
QLoRA fine-tuning script for Llama 3.1 with 4-bit quantization
"""

import json
import os
from pathlib import Path
from typing import Optional

# Unsloth imports
# Note: Unsloth must be installed in python environment
# pip install "unsloth[colab-new] @ git+https://github.com/unslothai/unsloth.git"
from unsloth import FastLanguageModel
from unsloth import is_bfloat16_supported
from datasets import load_dataset
# import torch
from transformers import TrainingArguments
from trl import SFTTrainer

# Local imports
from myai.utils.dataset_manager import DatasetManager

# Configuration
MODEL_ID = "unsloth/Meta-Llama-3.1-8B-Instruct"
OUTPUT_DIR = "models/brunella_finetuned_v1"
GOLDEN_DATASET_PATH = "data/training/golden_dataset.jsonl"

# Training hyperparameters (RTX 3060 12GB optimized)
MAX_SEQ_LENGTH = 2048
BATCH_SIZE = 2
GRADIENT_ACCUMULATION_STEPS = 4
NUM_EPOCHS = 1
LEARNING_RATE = 2e-4
WARMUP_RATIO = 0.1

# QLoRA config
LORA_R = 16
LORA_ALPHA = 16
LORA_DROPOUT = 0.05
LORA_TARGET_MODULES = ["q_proj", "k_proj", "v_proj", "o_proj", "gate_proj", "up_proj", "down_proj"]


class BrunellaTrainer:
    """Handles Unsloth fine-tuning pipeline"""
    
    @staticmethod
    def load_model(load_in_4bit: bool = True):
        """Load Llama 3.1 8B with 4-bit quantization"""
        print(f"📦 Loading model: {MODEL_ID}")
        
        model, tokenizer = FastLanguageModel.from_pretrained(
            model_name=MODEL_ID,
            max_seq_length=MAX_SEQ_LENGTH,
            dtype=None,  # Auto-detect
            load_in_4bit=load_in_4bit,
            device_map="auto"
        )
        
        print(f"✅ Model loaded. Trainable params: {BrunellaTrainer._count_params(model)}")
        return model, tokenizer
    
    @staticmethod
    def setup_lora(model):
        """Apply QLoRA adapter configuration"""
        print(f"🔗 Applying QLoRA (r={LORA_R}, alpha={LORA_ALPHA})")
        
        model = FastLanguageModel.get_peft_model(
            model=model,
            r=LORA_R,
            lora_alpha=LORA_ALPHA,
            lora_dropout=LORA_DROPOUT,
            bias="none",
            use_gradient_checkpointing="unsloth",  # Reduce VRAM
            random_state=42,
            target_modules=LORA_TARGET_MODULES
        )
        
        return model
    
    @staticmethod
    def prepare_data(tokenizer, max_samples: Optional[int] = None):
        """Load and format golden dataset"""
        print(f"📚 Loading dataset from {GOLDEN_DATASET_PATH}")
        
        if not os.path.exists(GOLDEN_DATASET_PATH):
            raise FileNotFoundError(f"Golden dataset not found at {GOLDEN_DATASET_PATH}")
            
        dataset = load_dataset("json", data_files={"train": GOLDEN_DATASET_PATH})
        
        if max_samples:
             dataset["train"] = dataset["train"].select(range(min(len(dataset["train"]), max_samples)))

        # Format for ChatML
        def format_chatml(examples):
            texts = []
            for messages in examples["messages"]:
                # Using Unsloth's built-in chat template if available, or manual formatting
                formatted = tokenizer.apply_chat_template(
                    messages, 
                    tokenize=False, 
                    add_generation_prompt=False
                )
                texts.append(formatted)
            return {"text": texts}

        dataset = dataset.map(format_chatml, batched=True)
        print(f"✅ Loaded {len(dataset['train'])} samples")
        
        return dataset
    
    @staticmethod
    def train(model, tokenizer, dataset):
        """Execute fine-tuning with SFTTrainer"""
        print("\n🚀 Starting fine-tuning (Unsloth)...")
        
        training_args = TrainingArguments(
            output_dir=OUTPUT_DIR,
            per_device_train_batch_size=BATCH_SIZE,
            gradient_accumulation_steps=GRADIENT_ACCUMULATION_STEPS,
            num_train_epochs=NUM_EPOCHS,
            learning_rate=LEARNING_RATE,
            warmup_ratio=WARMUP_RATIO,
            optim="paged_adamw_8bit",  # Memory-efficient optimizer
            logging_steps=5,
            save_strategy="epoch",
            fp16=not is_bfloat16_supported(),
            bf16=is_bfloat16_supported(),
            gradient_checkpointing=True,
        )
        
        trainer = SFTTrainer(
            model=model,
            tokenizer=tokenizer,
            train_dataset=dataset["train"],
            dataset_text_field="text",
            max_seq_length=MAX_SEQ_LENGTH,
            dataset_num_proc=2,
            packing=False, # Can set to True for faster training
            args=training_args,
        )
        
        # Train
        train_result = trainer.train()
        
        print(f"\n✅ Training complete!")
        print(f"Final loss: {train_result.training_loss:.4f}")
        
        return model, trainer
    
    @staticmethod
    def save_model(model, tokenizer, output_path: str = OUTPUT_DIR):
        """Save trained model in GGUF format for Ollama"""
        print(f"\n💾 Saving model to {output_path}")
        
        # Save LoRA adapters
        model.save_pretrained(output_path) 
        tokenizer.save_pretrained(output_path)
        
        # Attempt GGUF export (requires llama.cpp)
        print("🔄 Converting to GGUF (q4_k_m)...")
        try:
             # FastLanguageModel supports direct GGUF export now
             model.save_pretrained_gguf(output_path, tokenizer, quantization_method = "q4_k_m")
             print(f"✅ GGUF model saved to {output_path}")
        except Exception as e:
            print(f"⚠️ Automatic GGUF conversion failed: {e}")
            print("Please perform manual conversion using llama.cpp")

        return output_path
    
    @staticmethod
    def _count_params(model):
        """Count trainable parameters"""
        trainable = sum(p.numel() for p in model.parameters() if p.requires_grad)
        total = sum(p.numel() for p in model.parameters())
        return f"{trainable:,}/{total:,}"


def main():
    """Main training pipeline"""
    import argparse
    import sys
    
    parser = argparse.ArgumentParser(description="Brunella Unsloth Fine-tuning")
    parser.add_argument("--max-samples", type=int, default=None, help="Max dataset samples")
    parser.add_argument("--no-train", action="store_true", help="Skip training for testing setup")
    args = parser.parse_args()
    
    print("\n" + "="*60)
    print("🧠 BRUNELLA INCUBATOR - UNSLOTH FINE-TUNING MOTOR")
    print("="*60)
    print(f"Model: {MODEL_ID}")
    
    # Check dependencies
    try:
        import unsloth
        print(f"Unsloth version: {unsloth.__version__}")
    except ImportError:
        print("❌ CRITICAL: Unsloth not installed!")
        print("Run: pip install \"unsloth[colab-new] @ git+https://github.com/unslothai/unsloth.git\"")
        print("And: pip install --no-deps \"xformers<0.0.27\" \"trl<0.9.0\" peft accelerate bitsandbytes")
        sys.exit(1)

    # Check dataset
    stats = DatasetManager.get_dataset_stats()
    if stats['total_samples'] == 0:
        print("❌ No golden dataset found! Run dataset_manager.py test first.")
        return
    
    print(f"✅ Dataset ready: {stats['total_samples']} samples")
    
    # Load model
    print("Loading model (this may take time)...")
    try:
        model, tokenizer = BrunellaTrainer.load_model()
    except Exception as e:
        print(f"❌ Error loading model: {e}")
        return

    # Setup QLoRA
    model = BrunellaTrainer.setup_lora(model)
    
    # Load and prepare data
    try:
        dataset = BrunellaTrainer.prepare_data(tokenizer, args.max_samples)
    except Exception as e:
         print(f"❌ Error preparing data: {e}")
         return
    
    # Train (if not skipped)
    if not args.no_train:
        model, trainer = BrunellaTrainer.train(model, tokenizer, dataset)
        
        # Save
        BrunellaTrainer.save_model(model, tokenizer)
    else:
        print("⚠️ Training skipped (--no-train)")
    
    print("\n" + "="*60)
    print("✅ PIPELINE FINISHED")
    print("="*60)


if __name__ == "__main__":
    main()
