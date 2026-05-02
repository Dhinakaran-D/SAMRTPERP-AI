"""
Ollama-powered Chat Handler (Offline Mode)
Uses local Ollama models for chat without internet
"""

import logging
import requests
from typing import List, Dict, Any

logger = logging.getLogger(__name__)

class OllamaChat:
    """Handle chat using local Ollama LLM"""
    
    def __init__(self, rag_pipeline, model_name: str = "llama3.2"):
        """
        Initialize Ollama Chat Handler
        
        Args:
            rag_pipeline: RAG pipeline instance
            model_name: Ollama model name (default: llama3.2)
        """
        self.rag_pipeline = rag_pipeline
        self.model_name = model_name
        self.ollama_url = "http://localhost:11434/api/generate"
        logger.info(f"Ollama Chat initialized with model: {model_name}")
        
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
    
    def answer_question(self, question: str, chat_history: List[Dict] = None) -> str:
        """
        Answer a question using Ollama and RAG context
        
        Args:
            question: User's question
            chat_history: Previous chat history
        
        Returns:
            Answer string
        """
        try:
            logger.info(f"Processing question with Ollama: {question[:100]}...")
            
            # Check Ollama availability
            if not self._check_ollama_available():
                return "⚠️ Ollama is not running. Please start Ollama service with 'ollama serve'"
            
            # Get relevant context from RAG pipeline
            context = self._get_relevant_context(question)
            logger.info(f"Retrieved context (length: {len(context)})")
            
            # Create prompt with context
            prompt = self._create_chat_prompt(question, context, chat_history)
            logger.info(f"Created prompt (length: {len(prompt)})")
            
            # Get answer from Ollama
            answer = self._call_ollama(prompt)
            
            if not answer:
                return "Sorry, I couldn't generate a response. Please check if Ollama is running."
            
            logger.info(f"Generated answer (length: {len(answer)})")
            return answer
            
        except Exception as e:
            logger.error(f"Error in Ollama chat: {str(e)}")
            import traceback
            logger.error(f"Traceback: {traceback.format_exc()}")
            return f"Error: {str(e)}"
    
    def _get_relevant_context(self, question: str) -> str:
        """Get relevant context from uploaded documents"""
        if not hasattr(self.rag_pipeline, 'chunks') or not self.rag_pipeline.chunks:
            return "No documents uploaded yet."
        
        # Enhanced keyword matching
        question_lower = question.lower()
        question_words = set(w.lower().strip(',.!?;:') for w in question.split() if len(w) > 2)
        
        scored_chunks = []
        for chunk in self.rag_pipeline.chunks:
            chunk_lower = chunk.lower()
            score = 0
            
            # Exact phrase match
            if question_lower in chunk_lower:
                score += 20
            
            # Word match scoring
            for word in question_words:
                if word in chunk_lower:
                    score += 2
            
            if score > 0:
                scored_chunks.append((chunk, score))
        
        # Sort by relevance and get top chunks
        scored_chunks.sort(key=lambda x: x[1], reverse=True)
        top_chunks = [chunk for chunk, score in scored_chunks[:3]]
        
        if not top_chunks:
            # Return first few chunks as fallback
            return "\n\n".join(self.rag_pipeline.chunks[:3])
        
        return "\n\n".join(top_chunks)
    
    def _create_chat_prompt(self, question: str, context: str, chat_history: List[Dict] = None) -> str:
        """Create prompt for Ollama"""
        
        # Build chat history context
        history_text = ""
        if chat_history:
            for msg in chat_history[-3:]:  # Last 3 exchanges
                role = msg.get('role', 'user')
                content = msg.get('content', '')
                history_text += f"{role.upper()}: {content}\n"
        
        prompt = f"""You are a helpful AI assistant for an exam preparation platform. Answer the user's question based on the provided context from their uploaded documents.

CONTEXT FROM DOCUMENTS:
{context[:2000]}

{"PREVIOUS CONVERSATION:" if history_text else ""}
{history_text}

USER QUESTION: {question}

INSTRUCTIONS:
1. Answer based primarily on the provided context
2. If the context doesn't contain the answer, say so and provide general knowledge
3. Be concise but informative
4. Use formatting for clarity (bullet points, numbers, etc.)
5. If asked to generate MCQs or tests, politely suggest using the MCQ generation feature instead

ANSWER:"""
        
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
                    "top_p": 0.9,
                    "num_predict": 500
                }
            }
            
            response = requests.post(self.ollama_url, json=payload, timeout=60)
            
            if response.status_code == 200:
                result = response.json()
                return result.get('response', '').strip()
            else:
                logger.error(f"Ollama API error: {response.status_code} - {response.text}")
                return ""
                
        except requests.exceptions.Timeout:
            logger.error("Ollama request timed out")
            return "Request timed out. The model might be too slow or not responding."
        except Exception as e:
            logger.error(f"Error calling Ollama: {str(e)}")
            return ""
    
    def get_available_models(self) -> List[str]:
        """Get list of available Ollama models"""
        try:
            response = requests.get("http://localhost:11434/api/tags", timeout=5)
            if response.status_code == 200:
                data = response.json()
                models = [model['name'] for model in data.get('models', [])]
                return models
            return []
        except:
            return []
