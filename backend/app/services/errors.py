from __future__ import annotations


class AppError(Exception):
    def __init__(self, message: str, code: str = "APP_ERROR"):
        super().__init__(message)
        self.message = message
        self.code = code
