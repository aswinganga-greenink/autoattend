import math
import random
from typing import Tuple, List, Optional
from app.ml.base import FaceRecognitionEngineBase

class MockFaceRecognitionEngine(FaceRecognitionEngineBase):
    """
    A mock implementation of the face recognition engine for development purposes.
    It generates deterministic dummy 128-d embeddings based on image bytes.
    """
    def __init__(self):
        self.embedding_dimension = 128

    async def generate_embedding(self, image_bytes: bytes) -> List[float]:
        """
        Takes raw image bytes and returns a dummy 128-dimensional embedding vector.
        """
        seed = len(image_bytes)
        if seed > 0:
            seed += image_bytes[0]
            
        random.seed(seed)
        
        # Generate 128 random floats between -1 and 1
        embedding = [random.uniform(-1.0, 1.0) for _ in range(self.embedding_dimension)]
        
        # Normalize the vector (L2 norm)
        magnitude = math.sqrt(sum(x*x for x in embedding))
        if magnitude > 0:
            embedding = [x / magnitude for x in embedding]
            
        return embedding

    def compute_cosine_similarity(self, vec1: List[float], vec2: List[float]) -> float:
        """
        Computes the cosine similarity between two vectors.
        """
        if not vec1 or not vec2 or len(vec1) != len(vec2):
            return 0.0
            
        dot_product = sum(a * b for a, b in zip(vec1, vec2))
        return dot_product

    async def match_face(self, db_session, image_bytes: bytes) -> Tuple[bool, float, Optional[str]]:
        """
        Compares an uploaded image against all registered student embeddings in the DB.
        """
        from sqlalchemy import select
        from app.models.profiles import StudentProfile
        
        target_embedding = await self.generate_embedding(image_bytes)
        
        result = await db_session.execute(
            select(StudentProfile).where(StudentProfile.face_encoding.isnot(None))
        )
        profiles = result.scalars().all()
        
        best_match_id = None
        highest_similarity = -1.0
        
        for profile in profiles:
            similarity = self.compute_cosine_similarity(target_embedding, profile.face_encoding)
            if similarity > highest_similarity:
                highest_similarity = similarity
                best_match_id = str(profile.user_id)
                
        similarity_threshold = 0.75
        
        if highest_similarity >= similarity_threshold and best_match_id:
            return True, highest_similarity, best_match_id
        else:
            return False, highest_similarity, best_match_id

    async def register_face(self, student_id: str, image_bytes: bytes) -> bool:
        """
        Mock registering a face. Handled in API route now to save to DB.
        """
        return True

# Singleton instance
mock_engine = MockFaceRecognitionEngine()
