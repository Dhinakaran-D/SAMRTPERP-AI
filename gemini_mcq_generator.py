"""
Gemini-powered MCQ Generator
Uses Google Gemini API to generate intelligent MCQs from uploaded PDF content
"""

import os
import logging
import json
import google.generativeai as genai
from dotenv import load_dotenv
from typing import List, Dict, Any

logger = logging.getLogger(__name__)

class GeminiMCQGenerator:
    """Generate MCQs using Google Gemini API"""
    
    def __init__(self, rag_pipeline):
        """
        Initialize Gemini MCQ Generator
        
        Args:
            rag_pipeline: RAG pipeline instance
        """
        self.rag_pipeline = rag_pipeline
        load_dotenv()
        
        # Initialize Gemini
        api_key = os.getenv('GEMINI_API_KEY')
        if not api_key:
            raise ValueError("GEMINI_API_KEY not found in environment variables")
        
        logger.info(f"Initializing Gemini with API key: {api_key[:10]}...")
        genai.configure(api_key=api_key)
        self.model = genai.GenerativeModel('gemini-2.5-flash')
        logger.info("Gemini model initialized successfully")
        
    def generate_mcqs(self, topic: str, num_questions: int = 5,
                     difficulty: str = 'medium') -> List[Dict[str, Any]]:
        """
        Generate MCQs for a given topic using Gemini API
        
        Args:
            topic: Topic for MCQ generation
            num_questions: Number of questions to generate
            difficulty: Difficulty level (easy, medium, hard)
        
        Returns:
            List of MCQ questions
        """
        try:
            logger.info(f"Starting MCQ generation for topic: {topic}")
            
            # Get relevant content from RAG pipeline
            relevant_content = self._get_relevant_content(topic)
            logger.info(f"Retrieved {len(relevant_content)} characters of relevant content for topic: {topic}")
            
            if not relevant_content or len(relevant_content.strip()) < 50:
                logger.warning(f"No sufficient relevant content found for topic: {topic} (length: {len(relevant_content)})")
                logger.warning("Attempting fallback to document content...")
                # Fallback: try to get content from all chunks
                if hasattr(self.rag_pipeline, 'chunks') and self.rag_pipeline.chunks:
                    relevant_content = "\n\n".join(self.rag_pipeline.chunks[:10])
                    logger.info(f"Using fallback content: {len(relevant_content)} chars")
                else:
                    logger.error("No chunks available in RAG pipeline")
                    return []
            
            # Create prompt for Gemini
            prompt = self._create_mcq_prompt(relevant_content, topic, num_questions, difficulty)
            logger.info(f"Created prompt for Gemini (length: {len(prompt)})")
            
            # Generate MCQs using Gemini
            logger.info("Calling Gemini API...")
            response = self.model.generate_content(prompt)
            logger.info(f"Gemini response received (length: {len(response.text)})")
            
            # Parse Gemini response
            mcqs = self._parse_gemini_response(response.text, topic, difficulty)
            
            logger.info(f"Generated {len(mcqs)} MCQs using Gemini for topic: {topic}")
            return mcqs
            
        except Exception as e:
            logger.error(f"Error generating MCQs with Gemini: {str(e)}")
            import traceback
            logger.error(f"Traceback: {traceback.format_exc()}")
            return []
    
    def _get_relevant_content(self, topic: str) -> str:
        """Get relevant content from uploaded documents"""
        if not hasattr(self.rag_pipeline, 'chunks') or not self.rag_pipeline.chunks:
            return ""
        
        # Enhanced keyword matching to find relevant chunks
        topic_lower = topic.lower()
        topic_words = set(w.lower().strip() for w in topic.split() if len(w) > 2)
        
        # Score each chunk based on relevance
        scored_chunks = []
        
        for chunk in self.rag_pipeline.chunks:
            chunk_lower = chunk.lower()
            score = 0
            
            # Exact topic match gets highest score
            if topic_lower in chunk_lower:
                score += 10
            
            # Individual word matches
            for word in topic_words:
                if word in chunk_lower:
                    score += 3
                # Partial word match (e.g., "history" matches "historian")
                if word in chunk_lower or any(word in w for w in chunk_lower.split()):
                    score += 1
            
            if score > 0:
                scored_chunks.append((score, chunk))
        
        # Sort by score descending
        scored_chunks.sort(reverse=True, key=lambda x: x[0])
        
        # If no keyword matches, use chunks related to document category
        if not scored_chunks:
            # Try to find chunks from documents with matching categories
            if hasattr(self.rag_pipeline, 'documents'):
                for doc_name, doc_info in self.rag_pipeline.documents.items():
                    if topic.lower() in doc_name.lower():
                        # Return chunks from this document if available
                        scored_chunks = [(5, chunk) for chunk in self.rag_pipeline.chunks[:10]]
                        break
        
        # If still nothing found, use first chunks
        if not scored_chunks:
            scored_chunks = [(1, chunk) for chunk in self.rag_pipeline.chunks[:5]]
        
        # Extract just the chunks and limit to first 15
        relevant_chunks = [chunk for score, chunk in scored_chunks[:15]]
        
        logger.info(f"Found {len(relevant_chunks)} relevant chunks for topic: {topic}")
        return "\n\n".join(relevant_chunks)
    
    def _create_mcq_prompt(self, content: str, topic: str, num_questions: int, difficulty: str) -> str:
        """Create prompt for Gemini API"""
        return f"""
        You are an expert educational content creator. Based on the provided study material, create {num_questions} multiple-choice questions about {topic}.

        Study Material:
        {content}

        Requirements:
        1. Create exactly {num_questions} questions
        2. Difficulty level: {difficulty}
        3. Each question must have 4 options (A, B, C, D)
        4. Only one option should be correct
        5. Questions should be based on the actual content provided
        6. Include a brief explanation for each question
        7. Format your response as valid JSON only

        Response format:
        {{
            "questions": [
                {{
                    "question": "Question text here",
                    "options": ["A) Option A", "B) Option B", "C) Option C", "D) Option D"],
                    "correct_answer": "A",
                    "explanation": "Brief explanation here"
                }}
            ]
        }}
        """
    
    def _parse_gemini_response(self, response_text: str, topic: str, difficulty: str) -> List[Dict[str, Any]]:
        """Parse Gemini response into MCQ format"""
        try:
            logger.debug(f"Parsing response (first 200 chars): {response_text[:200]}")
            
            # Try to parse as JSON
            response_text = response_text.strip()
            
            # Extract JSON from response - handle multiple formats
            json_text = response_text
            
            if '```json' in response_text:
                json_start = response_text.find('```json') + 7
                json_end = response_text.find('```', json_start)
                if json_end > json_start:
                    json_text = response_text[json_start:json_end].strip()
                    logger.debug("Extracted JSON from ```json``` block")
            elif '```' in response_text:
                # Try to extract from generic code block
                json_start = response_text.find('```') + 3
                json_end = response_text.find('```', json_start)
                if json_end > json_start:
                    json_text = response_text[json_start:json_end].strip()
                    logger.debug("Extracted JSON from generic code block")
            
            # If no code block found, try to extract JSON directly
            if json_text == response_text and '{' in response_text:
                json_start = response_text.find('{')
                json_end = response_text.rfind('}') + 1
                if json_end > json_start:
                    json_text = response_text[json_start:json_end]
                    logger.debug("Extracted JSON from raw text")
            
            logger.debug(f"JSON text to parse (first 200 chars): {json_text[:200]}")
            
            # Parse JSON
            data = json.loads(json_text)
            logger.debug(f"JSON parsed successfully: {type(data)}")
            
            if 'questions' not in data:
                logger.error(f"No 'questions' key in Gemini response. Keys: {data.keys()}")
                return []
            
            mcqs = []
            for i, q_data in enumerate(data['questions']):
                try:
                    mcq = {
                        'id': i + 1,
                        'question': q_data.get('question', '').strip(),
                        'options': [opt.strip() if isinstance(opt, str) else opt for opt in q_data.get('options', ['', '', '', ''])],
                        'correct_answer': q_data.get('correct_answer', 'A').strip(),
                        'explanation': q_data.get('explanation', '').strip(),
                        'difficulty': difficulty,
                        'topic': topic
                    }
                    if mcq['question'] and mcq['options'] and len(mcq['options']) == 4:
                        mcqs.append(mcq)
                    else:
                        logger.warning(f"Question {i+1} missing required fields")
                except Exception as e:
                    logger.warning(f"Error processing question {i+1}: {e}")
                    continue
            
            logger.info(f"Successfully parsed {len(mcqs)} questions from response")
            return mcqs
            
        except json.JSONDecodeError as e:
            logger.error(f"JSON parsing error: {str(e)}")
            logger.error(f"Response text (first 500 chars): {response_text[:500]}")
            return []
        except Exception as e:
            logger.error(f"Error parsing Gemini response: {str(e)}")
            import traceback
            logger.error(f"Traceback: {traceback.format_exc()}")
            return []
