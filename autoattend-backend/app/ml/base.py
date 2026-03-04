from abc import ABC, abstractmethod
from typing import Dict, Any, Tuple

class FaceRecognitionEngineBase(ABC):
    @abstractmethod
    async def match_face(self, db_session, image_bytes: bytes) -> Tuple[bool, float, str | None]:
        """
        Process an image and return:
        - bool: Match successful
        - float: Confidence score (0.0 to 1.0)
        - str | None: Matched Student ID (if successful)
        """
        pass
    
    @abstractmethod
    async def register_face(self, student_id: str, image_bytes: bytes) -> bool:
        """
        Extract features from image_bytes and store them for the student_id
        """
        pass
