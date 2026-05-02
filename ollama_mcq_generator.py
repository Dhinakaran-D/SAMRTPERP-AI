"""
Ollama-powered MCQ Generator (Offline Mode)
Uses local Ollama models to generate intelligent MCQs without internet
"""

import os
import logging
import json
import requests
from typing import List, Dict, Any

logger = logging.getLogger(__name__)

class OllamaMCQGenerator:
    """Generate MCQs using local Ollama LLM"""
    
    def __init__(self, rag_pipeline, model_name: str = "llama3.2"):
        """
        Initialize Ollama MCQ Generator
        
        Args:
            rag_pipeline: RAG pipeline instance
            model_name: Ollama model name (default: llama3.2)
        """
        self.rag_pipeline = rag_pipeline
        self.model_name = model_name
        self.ollama_url = "http://localhost:11434/api/generate"
        logger.info(f"Ollama MCQ Generator initialized with model: {model_name}")
        
        # Check if Ollama is running
        if not self._check_ollama_available():
            logger.warning("Ollama is not running or not accessible at localhost:11434")
    
    def _check_ollama_available(self) -> bool:
        """Check if Ollama service is available"""
        try:
            response = requests.get("http://localhost:11434/api/tags", timeout=2)
            return response.status_code == 200
        except:
            return False
    
    def generate_mcqs(self, topic: str, num_questions: int = 5,
                     difficulty: str = 'medium') -> List[Dict[str, Any]]:
        """
        Generate MCQs for a given topic using Ollama
        
        Args:
            topic: Topic for MCQ generation
            num_questions: Number of questions to generate
            difficulty: Difficulty level (easy, medium, hard)
        
        Returns:
            List of MCQ questions
        """
        try:
            logger.info(f"Starting offline MCQ generation for topic: {topic}")
            
            # Check Ollama availability
            if not self._check_ollama_available():
                logger.error("Ollama is not available. Please start Ollama service.")
                return []
            
            # Get relevant content from RAG pipeline
            relevant_content = self._get_relevant_content(topic)
            logger.info(f"Retrieved {len(relevant_content)} characters of relevant content")
            
            if not relevant_content or len(relevant_content.strip()) < 50:
                logger.warning(f"Insufficient content for topic: {topic}")
                # Fallback to chunks
                if hasattr(self.rag_pipeline, 'chunks') and self.rag_pipeline.chunks:
                    relevant_content = "\n\n".join(self.rag_pipeline.chunks[:10])
                    logger.info(f"Using fallback content: {len(relevant_content)} chars")
                else:
                    logger.error("No chunks available in RAG pipeline")
                    return []
            
            # Create prompt for Ollama
            prompt = self._create_mcq_prompt(relevant_content, topic, num_questions, difficulty)
            logger.info(f"Created prompt (length: {len(prompt)})")
            
            # Generate MCQs using Ollama
            logger.info("Calling Ollama API...")
            response_text = self._call_ollama(prompt)
            logger.info(f"Ollama response received (length: {len(response_text)})")
            
            # Parse response
            mcqs = self._parse_ollama_response(response_text, topic, difficulty)
            
            logger.info(f"Generated {len(mcqs)} MCQs using Ollama for topic: {topic}")
            return mcqs
            
        except Exception as e:
            logger.error(f"Error generating MCQs with Ollama: {str(e)}")
            import traceback
            logger.error(f"Traceback: {traceback.format_exc()}")
            return []
    
    def _get_relevant_content(self, topic: str) -> str:
        """Get relevant content from uploaded documents"""
        if not hasattr(self.rag_pipeline, 'chunks') or not self.rag_pipeline.chunks:
            return ""
        
        # Enhanced keyword matching
        topic_lower = topic.lower()
        topic_words = set(w.lower().strip() for w in topic.split() if len(w) > 2)
        
        scored_chunks = []
        for chunk in self.rag_pipeline.chunks:
            chunk_lower = chunk.lower()
            score = 0
            
            # Exact topic match
            if topic_lower in chunk_lower:
                score += 10
            
            # Word match scoring
            for word in topic_words:
                if word in chunk_lower:
                    score += 2
            
            if score > 0:
                scored_chunks.append((chunk, score))
        
        # Sort by relevance and get top chunks
        scored_chunks.sort(key=lambda x: x[1], reverse=True)
        top_chunks = [chunk for chunk, score in scored_chunks[:5]]
        
        return "\n\n".join(top_chunks)
    
    def _create_mcq_prompt(self, content: str, topic: str, num_questions: int, difficulty: str) -> str:
        """Create prompt for Ollama"""
        difficulty_instructions = {
            'easy': 'Generate EASY level questions that test basic understanding and recall.',
            'medium': 'Generate MEDIUM level questions that test comprehension and application.',
            'hard': 'Generate HARD level questions that test analysis, evaluation, and complex reasoning.'
        }
        
        prompt = f"""You are an expert MCQ generator. Based on the following content about "{topic}", generate {num_questions} multiple-choice questions.

{difficulty_instructions.get(difficulty, difficulty_instructions['medium'])}

CONTENT:
{content[:3000]}

REQUIREMENTS:
1. Generate EXACTLY {num_questions} questions
2. Each question must have exactly 4 options (A, B, C, D)
3. Mark the correct answer clearly
4. Questions should be clear and unambiguous
5. Options should be plausible but only one correct

OUTPUT FORMAT (JSON):
{{
  "questions": [
    {{
      "question": "Question text here?",
      "options": {{
        "A": "First option",
        "B": "Second option",
        "C": "Third option",
        "D": "Fourth option"
      }},
      "correct_answer": "A",
      "explanation": "Brief explanation of why this is correct"
    }}
  ]
}}

Generate the MCQs now in valid JSON format:"""
        
        return prompt
    
    def _call_ollama(self, prompt: str) -> str:
        """Call Ollama API"""
        try:
            payload = {
                "model": self.model_name,
                "prompt": prompt,
                "stream": False,
                "options": {
                    "temperature": 0.7,
                    "top_p": 0.9
                }
            }
            
            response = requests.post(self.ollama_url, json=payload, timeout=120)
            
            if response.status_code == 200:
                result = response.json()
                return result.get('response', '')
            else:
                logger.error(f"Ollama API error: {response.status_code} - {response.text}")
                return ""
                
        except Exception as e:
            logger.error(f"Error calling Ollama: {str(e)}")
            return ""
    
    def _parse_ollama_response(self, response_text: str, topic: str, difficulty: str) -> List[Dict[str, Any]]:
        """Parse Ollama response into MCQ format"""
        try:
            # Try to extract JSON from response
            json_start = response_text.find('{')
            json_end = response_text.rfind('}') + 1
            
            if json_start != -1 and json_end > json_start:
                json_str = response_text[json_start:json_end]
                data = json.loads(json_str)
                
                if 'questions' in data:
                    mcqs = []
                    for idx, q in enumerate(data['questions']):
                        mcq = {
                            'id': idx + 1,
                            'question': q.get('question', ''),
                            'options': q.get('options', {}),
                            'correct_answer': q.get('correct_answer', 'A'),
                            'explanation': q.get('explanation', ''),
                            'topic': topic,
                            'difficulty': difficulty
                        }
                        mcqs.append(mcq)
                    
                    return mcqs
            
            # Fallback: manual parsing
            logger.warning("Failed to parse JSON, using fallback parsing")
            return self._fallback_parse(response_text, topic, difficulty)
            
        except Exception as e:
            logger.error(f"Error parsing Ollama response: {str(e)}")
            return self._fallback_parse(response_text, topic, difficulty)
    
    def _fallback_parse(self, text: str, topic: str, difficulty: str) -> List[Dict[str, Any]]:
        """Fallback parsing when JSON parsing fails"""
        mcqs = []
        
        # Simple fallback MCQ
        mcqs.append({
            'id': 1,
            'question': f"What is the main concept related to {topic}?",
            'options': {
                'A': f"Primary aspect of {topic}",
                'B': f"Secondary aspect of {topic}",
                'C': f"Tertiary aspect of {topic}",
                'D': f"Unrelated concept"
            },
            'correct_answer': 'A',
            'explanation': f"This is related to the main concepts of {topic}",
            'topic': topic,
            'difficulty': difficulty
        })
        
        return mcqs
