import logging
import os
from logging.handlers import RotatingFileHandler
import sys
from dotenv import load_dotenv

# Загружаем переменные окружения
load_dotenv()

def setup_logging():
    """
    Configures logging for the application.
    Logs will be output to both the console and a rotating file.
    """
    # Получаем настройки из переменных окружения
    log_level = os.getenv("LOG_LEVEL", "INFO").upper()
    error_log_file = os.getenv("ERROR_LOG_FILE", "error.log")
    log_max_bytes = int(os.getenv("LOG_MAX_BYTES", "5242880"))  # 5 MB по умолчанию
    log_backup_count = int(os.getenv("LOG_BACKUP_COUNT", "2"))
    
    # Create a logger
    logger = logging.getLogger("app")
    logger.setLevel(getattr(logging, log_level, logging.INFO)) # Set the lowest level to capture all messages

    # Create a formatter
    formatter = logging.Formatter(
        '%(asctime)s - %(name)s - %(levelname)s - %(message)s '
        '[in %(pathname)s:%(lineno)d]'
    )

    # --- Console Handler ---
    # This handler will print logs to the console (stdout)
    console_handler = logging.StreamHandler(sys.stdout)
    console_handler.setLevel(getattr(logging, log_level, logging.INFO)) # Log INFO and above to console
    console_handler.setFormatter(formatter)

    # --- File Handler for Errors ---
    # This handler will write ERROR and CRITICAL logs to a file
    # It uses RotatingFileHandler to manage log file size.
    error_file_handler = RotatingFileHandler(
        error_log_file, maxBytes=log_max_bytes, backupCount=log_backup_count
    )
    error_file_handler.setLevel(logging.ERROR) # Log ERROR and above to file
    error_file_handler.setFormatter(formatter)

    # Add handlers to the logger
    # Avoid adding handlers if they already exist (e.g., in a reload scenario)
    if not logger.handlers:
        logger.addHandler(console_handler)
        logger.addHandler(error_file_handler)

    return logger

# Create the logger instance to be imported by other modules
app_logger = setup_logging()
