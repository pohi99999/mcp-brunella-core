"""Phoenix Protocol: Auto-Retry & Self-Healing Utilities

Implements the Phoenix Protocol for automatic error recovery:
- Exponential backoff retry logic
- Network error detection
- Auto-reset state management
- Logging for debugging

Based on: conductor/workflow.md Section 2 - Phoenix Protocol
"""

import time
import logging
from typing import Callable, TypeVar, Any, Optional
from functools import wraps

logger = logging.getLogger(__name__)

T = TypeVar('T')


class PhoenixRetryError(Exception):
    """Raised when all retry attempts are exhausted."""
    pass


def with_retry(
    max_retries: int = 3,
    initial_delay: float = 1.0,
    max_delay: float = 30.0,
    backoff_factor: float = 2.0,
    retryable_exceptions: tuple = (Exception,),
    on_retry: Optional[Callable[[int, Exception], None]] = None,
):
    """
    Phoenix Protocol Retry Decorator
    
    Automatically retries function on failure with exponential backoff.
    
    Args:
        max_retries: Maximum number of retry attempts
        initial_delay: Initial delay in seconds before first retry
        max_delay: Maximum delay between retries
        backoff_factor: Exponential backoff multiplier
        retryable_exceptions: Tuple of exceptions to retry on
        on_retry: Callback function called on each retry (attempt, exception)
    
    Returns:
        Decorated function with retry logic
    
    Example:
        @with_retry(max_retries=5, initial_delay=2.0)
        def fetch_data():
            return api.get_data()
    """
    def decorator(func: Callable[..., T]) -> Callable[..., T]:
        @wraps(func)
        def wrapper(*args: Any, **kwargs: Any) -> T:
            delay = initial_delay
            last_exception = None
            
            for attempt in range(max_retries + 1):
                try:
                    return func(*args, **kwargs)
                except retryable_exceptions as e:
                    last_exception = e
                    
                    if attempt == max_retries:
                        # All retries exhausted
                        logger.error(
                            f"Phoenix Protocol: All {max_retries} retries exhausted for {func.__name__}",
                            exc_info=True
                        )
                        raise PhoenixRetryError(
                            f"Failed after {max_retries} retries: {str(e)}"
                        ) from e
                    
                    # Calculate backoff delay
                    current_delay = min(delay, max_delay)
                    
                    logger.warning(
                        f"Phoenix Protocol: Retry {attempt + 1}/{max_retries} for {func.__name__} "
                        f"after {current_delay:.1f}s (error: {type(e).__name__})"
                    )
                    
                    # Call retry callback if provided
                    if on_retry:
                        try:
                            on_retry(attempt + 1, e)
                        except Exception as callback_error:
                            logger.error(
                                f"Retry callback error: {callback_error}",
                                exc_info=True
                            )
                    
                    # Wait before retry
                    time.sleep(current_delay)
                    
                    # Exponential backoff
                    delay *= backoff_factor
            
            # Should never reach here, but just in case
            raise PhoenixRetryError(
                f"Unexpected retry logic exit: {last_exception}"
            ) from last_exception
        
        return wrapper
    return decorator


def retry_on_network_error(
    max_retries: int = 5,
    initial_delay: float = 2.0,
):
    """
    Phoenix Protocol preset for network errors
    
    Retries common network/API errors:
    - ConnectionError
    - TimeoutError
    - requests.exceptions.RequestException
    - google.auth.exceptions.TransportError (Google API)
    - gspread.exceptions.APIError (Google Sheets)
    
    Args:
        max_retries: Maximum retry attempts (default 5)
        initial_delay: Initial delay seconds (default 2.0)
    
    Example:
        @retry_on_network_error(max_retries=3)
        def write_to_sheets(data):
            return sheets_client.update(data)
    """
    # Import exceptions that might not be installed
    network_exceptions = [
        ConnectionError,
        TimeoutError,
        OSError,  # Covers network-related OS errors
    ]
    
    try:
        import requests
        network_exceptions.append(requests.exceptions.RequestException)
    except ImportError:
        pass
    
    try:
        from google.auth import exceptions as google_exceptions
        network_exceptions.append(google_exceptions.TransportError)
    except ImportError:
        pass
    
    try:
        import gspread
        network_exceptions.extend([
            gspread.exceptions.APIError,
            gspread.exceptions.GSpreadException,
        ])
    except ImportError:
        pass
    
    return with_retry(
        max_retries=max_retries,
        initial_delay=initial_delay,
        max_delay=60.0,
        backoff_factor=2.5,
        retryable_exceptions=tuple(network_exceptions),
    )


class PhoenixCheckpoint:
    """
    Phoenix Protocol Checkpoint Manager
    
    Saves state before critical operations for rollback support.
    
    Example:
        checkpoint = PhoenixCheckpoint()
        checkpoint.save("operation_1", {"data": invoice_data})
        
        try:
            risky_operation()
        except Exception:
            previous_data = checkpoint.restore("operation_1")
    """
    
    def __init__(self):
        self._checkpoints: dict[str, Any] = {}
    
    def save(self, key: str, state: Any) -> None:
        """Save state checkpoint."""
        self._checkpoints[key] = state
        logger.debug(f"Phoenix Protocol: Checkpoint saved '{key}'")
    
    def restore(self, key: str) -> Any:
        """Restore state from checkpoint."""
        if key not in self._checkpoints:
            logger.warning(f"Phoenix Protocol: No checkpoint found for '{key}'")
            return None
        
        logger.info(f"Phoenix Protocol: Restoring checkpoint '{key}'")
        return self._checkpoints[key]
    
    def clear(self, key: Optional[str] = None) -> None:
        """Clear checkpoint(s)."""
        if key:
            self._checkpoints.pop(key, None)
            logger.debug(f"Phoenix Protocol: Checkpoint cleared '{key}'")
        else:
            self._checkpoints.clear()
            logger.debug("Phoenix Protocol: All checkpoints cleared")
    
    def has(self, key: str) -> bool:
        """Check if checkpoint exists."""
        return key in self._checkpoints


# Global checkpoint instance
_phoenix_checkpoint = PhoenixCheckpoint()


def get_checkpoint() -> PhoenixCheckpoint:
    """Get global Phoenix checkpoint instance."""
    return _phoenix_checkpoint


if __name__ == "__main__":
    # Test retry logic
    import sys
    
    @retry_on_network_error(max_retries=3, initial_delay=0.5)
    def flaky_function(fail_count: int = 2):
        """Test function that fails N times before succeeding."""
        if not hasattr(flaky_function, 'attempts'):
            flaky_function.attempts = 0
        
        flaky_function.attempts += 1
        print(f"Attempt {flaky_function.attempts}")
        
        if flaky_function.attempts <= fail_count:
            raise ConnectionError(f"Simulated network error (attempt {flaky_function.attempts})")
        
        return f"Success on attempt {flaky_function.attempts}"
    
    # Test
    logging.basicConfig(level=logging.INFO)
    
    try:
        result = flaky_function(fail_count=2)
        print(f"✅ Result: {result}")
    except PhoenixRetryError as e:
        print(f"❌ Failed: {e}")
        sys.exit(1)
    
    # Test checkpoint
    checkpoint = get_checkpoint()
    checkpoint.save("test", {"value": 123})
    restored = checkpoint.restore("test")
    print(f"✅ Checkpoint test: {restored}")
