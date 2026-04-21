#!/usr/bin/env python3
"""
Brunella Incubator - Golden Dataset Manager
ChatML format training data collection for fine-tuning
"""

import json
import os
from datetime import datetime
from typing import Dict, Any, List, Optional
from pathlib import Path

TRAINING_DATA_PATH = "data/training/golden_dataset.jsonl"


class DatasetManager:
    """Manages Brunella's Golden Dataset for fine-tuning"""
    
    @staticmethod
    def ensure_directories():
        """Create required directories"""
        Path(TRAINING_DATA_PATH).parent.mkdir(parents=True, exist_ok=True)
    
    @staticmethod
    def save_gold_sample(
        system_prompt: str,
        user_input: str,
        assistant_output: Any,
        source: str = "unknown",
        quality_score: float = 1.0,
        metadata: Optional[Dict[str, Any]] = None
    ) -> bool:
        """
        Save successful interaction to training dataset in ChatML format
        
        Args:
            system_prompt: System prompt
            user_input: User input
            assistant_output: Model output (dict or str)
            source: Data source (default: "unknown")
            quality_score: Quality score 0.0-1.0 (default: 1.0)
            metadata: Additional metadata
        
        Returns:
            bool: True on success, False on error
        """
        try:
            DatasetManager.ensure_directories()
            
            # Convert output to string if needed
            if isinstance(assistant_output, dict):
                assistant_content = json.dumps(assistant_output, ensure_ascii=False)
            else:
                assistant_content = str(assistant_output)
            
            entry = {
                "messages": [
                    {"role": "system", "content": system_prompt},
                    {"role": "user", "content": user_input},
                    {"role": "assistant", "content": assistant_content}
                ],
                "metadata": {
                    "timestamp": datetime.utcnow().isoformat(),
                    "source": source,
                    "quality_score": quality_score,
                    "client_version": "1.0"
                }
            }
            
            # Add extra metadata if provided
            if metadata:
                entry["metadata"].update(metadata)
            
            with open(TRAINING_DATA_PATH, "a", encoding="utf-8") as f:
                f.write(json.dumps(entry, ensure_ascii=False) + "\n")
            
            return True
        except Exception as e:
            print(f"❌ Error saving sample: {e}")
            return False
    
    @staticmethod
    def get_dataset_stats() -> Dict[str, Any]:
        """
        Get dataset statistics
        
        Returns:
            dict: {total_samples, sources, avg_quality, file_size_mb, status}
        """
        DatasetManager.ensure_directories()
        
        if not os.path.exists(TRAINING_DATA_PATH):
            return {
                "total_samples": 0,
                "sources": {},
                "avg_quality": 0.0,
                "file_size_mb": 0.0,
                "status": "EMPTY"
            }
        
        try:
            samples = []
            sources = {}
            quality_scores = []
            
            with open(TRAINING_DATA_PATH, "r", encoding="utf-8") as f:
                for line in f:
                    if line.strip():
                        try:
                            entry = json.loads(line)
                            samples.append(entry)
                            
                            source = entry.get("metadata", {}).get("source", "unknown")
                            sources[source] = sources.get(source, 0) + 1
                            
                            quality = entry.get("metadata", {}).get("quality_score", 1.0)
                            quality_scores.append(quality)
                        except json.JSONDecodeError:
                            pass
            
            total = len(samples)
            avg_quality = sum(quality_scores) / len(quality_scores) if quality_scores else 0.0
            file_size = os.path.getsize(TRAINING_DATA_PATH) / 1024 / 1024  # MB
            
            # Determine status
            if total == 0:
                status = "EMPTY"
            elif total < 5:
                status = f"BUILDING ({total}/5 min)"
            elif total < 100:
                status = "GROWING"
            else:
                status = "READY"
            
            return {
                "total_samples": total,
                "sources": sources,
                "avg_quality": round(avg_quality, 2),
                "file_size_mb": round(file_size, 2),
                "status": status
            }
        except Exception as e:
            print(f"❌ Error reading data: {e}")
            return {
                "total_samples": 0,
                "sources": {},
                "avg_quality": 0.0,
                "file_size_mb": 0.0,
                "status": "ERROR"
            }
    
    @staticmethod
    def load_dataset_for_training(max_samples: Optional[int] = None):
        """
        Load dataset in HuggingFace Dataset format for Unsloth training
        
        Args:
            max_samples: Maximum samples to load (None = all)
        
        Returns:
            Dataset or None
        """
        try:
            from datasets import Dataset
            
            if not os.path.exists(TRAINING_DATA_PATH):
                print(f"⚠️ File not found: {TRAINING_DATA_PATH}")
                return None
            
            samples = []
            with open(TRAINING_DATA_PATH, "r", encoding="utf-8") as f:
                for i, line in enumerate(f):
                    if max_samples and i >= max_samples:
                        break
                    if line.strip():
                        try:
                            samples.append(json.loads(line))
                        except json.JSONDecodeError:
                            pass
            
            if not samples:
                print("⚠️ No sample data in dataset")
                return None
            
            # Convert to HuggingFace Dataset
            dataset = Dataset.from_dict({
                "text": [
                    DatasetManager._format_chatml(s.get("messages", [])) 
                    for s in samples
                ]
            })
            
            return dataset
        except ImportError:
            print("❌ HuggingFace datasets not installed: pip install datasets")
            return None
        except Exception as e:
            print(f"❌ Error loading data: {e}")
            return None
    
    @staticmethod
    def _format_chatml(messages: List[Dict[str, str]]) -> str:
        """Format ChatML messages to string"""
        formatted = ""
        for msg in messages:
            role = msg.get("role", "user")
            content = msg.get("content", "")
            formatted += f"<|im_start|>{role}\n{content}\n<|im_end|>\n"
        return formatted
    
    @staticmethod
    def clear_dataset(force: bool = False) -> bool:
        """
        Safely delete the dataset
        
        Args:
            force: Skip confirmation
        
        Returns:
            bool: True on success, False on error
        """
        try:
            if not os.path.exists(TRAINING_DATA_PATH):
                return True
            
            if not force:
                print(f"⚠️ Will delete all data: {TRAINING_DATA_PATH}")
                confirm = input("Are you sure? (y/n): ").lower()
                if confirm != 'y':
                    print("❌ Delete cancelled")
                    return False
            
            os.remove(TRAINING_DATA_PATH)
            print("✅ Dataset deleted")
            return True
        except Exception as e:
            print(f"❌ Error deleting: {e}")
            return False


# ===== CLI INTERFACE =====

def cli_stats():
    """Display statistics from CLI"""
    stats = DatasetManager.get_dataset_stats()
    print("\n" + "="*50)
    print("📊 DATASET STATISTICS")
    print("="*50)
    print(f"Status: {stats['status']}")
    print(f"Total samples: {stats['total_samples']}")
    print(f"Average quality: {stats['avg_quality']}")
    print(f"File size: {stats['file_size_mb']} MB")
    if stats['sources']:
        print("\nSources:")
        for source, count in stats['sources'].items():
            print(f"  - {source}: {count}")
    print("="*50 + "\n")


def cli_test():
    """Test with 3 sample entries from CLI"""
    print("\n🧪 TEST: Saving 3 samples")
    print("="*50)
    
    samples = [
        {
            "system": "You are a helpful AI assistant.",
            "user": "What is Python?",
            "output": "Python is a high-level programming language.",
            "source": "test_sample_1"
        },
        {
            "system": "You are a data extraction expert.",
            "user": "<HTML><p>Test content</p></HTML>",
            "output": {"extracted": "Test content", "type": "html"},
            "source": "test_sample_2"
        },
        {
            "system": "You are a JSON validator.",
            "user": '{"key": "value"}',
            "output": {"valid": True, "format": "json"},
            "source": "test_sample_3"
        }
    ]
    
    for i, sample in enumerate(samples, 1):
        result = DatasetManager.save_gold_sample(
            system_prompt=sample["system"],
            user_input=sample["user"],
            assistant_output=sample["output"],
            source=sample["source"],
            quality_score=1.0
        )
        status = "✅ OK" if result else "❌ FAIL"
        print(f"[{i}/3] {sample['source']} → {status}")
    
    print("="*50)
    cli_stats()


def cli_clear():
    """Delete dataset from CLI"""
    DatasetManager.clear_dataset(force=False)


# ===== Top-level API (for easy integration) =====

def save_gold_sample(
    system_prompt: Optional[str] = None,
    user_input: Optional[str] = None,
    assistant_output: Optional[Any] = None,
    source: str = "unknown",
    quality_score: float = 1.0,
    metadata: Optional[Dict[str, Any]] = None,
    **kwargs: Any,
) -> bool:
    """
    Backward-compatible top-level alias for DatasetManager.save_gold_sample.

    Supports both calling styles:
      1) save_gold_sample(system_prompt=..., user_input=..., assistant_output=...)
      2) save_gold_sample(prompt=..., completion=..., source=..., quality=...)
    """
    prompt = kwargs.get("prompt")
    completion = kwargs.get("completion")
    quality = kwargs.get("quality")

    resolved_system_prompt = system_prompt or kwargs.get(
        "system", "You are a helpful AI assistant."
    )
    resolved_user_input = user_input if user_input is not None else prompt
    resolved_assistant_output = (
        assistant_output if assistant_output is not None else completion
    )
    resolved_quality = quality_score if quality is None else float(quality)

    if resolved_user_input is None or resolved_assistant_output is None:
        return False

    return DatasetManager.save_gold_sample(
        resolved_system_prompt,
        resolved_user_input,
        resolved_assistant_output,
        source,
        resolved_quality,
        metadata,
    )

def get_dataset_stats() -> Dict[str, Any]:
    """Top-level alias for DatasetManager.get_dataset_stats"""
    return DatasetManager.get_dataset_stats()


# ===== MAIN =====

if __name__ == "__main__":
    import sys
    
    if len(sys.argv) > 1:
        cmd = sys.argv[1]
        if cmd == "stats":
            cli_stats()
        elif cmd == "test":
            cli_test()
        elif cmd == "clear":
            cli_clear()
        else:
            print(f"Unknown command: {cmd}")
            print("Available: stats, test, clear")
    else:
        # Default: show stats
        cli_stats()
