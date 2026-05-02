"""
MCQ Generator Module
Generates multiple-choice questions from RAG pipeline
"""

import logging
import json
import random
from typing import List, Dict, Any

logger = logging.getLogger(__name__)

class MCQGenerator:
    """Generate MCQs from documents using RAG"""
    
    def __init__(self, rag_pipeline):
        """
        Initialize MCQ Generator
        
        Args:
            rag_pipeline: RAG pipeline instance
        """
        self.rag_pipeline = rag_pipeline
        self.difficulty_levels = {
            'easy': {
                'keywords': ['definition', 'basic', 'simple', 'what is', 'name', 'who'],
                'num_options': 4,
                'correct_ratio': 0.9
            },
            'medium': {
                'keywords': ['explain', 'reason', 'why', 'how', 'difference', 'example'],
                'num_options': 4,
                'correct_ratio': 0.7
            },
            'hard': {
                'keywords': ['analyze', 'compare', 'infer', 'evaluate', 'apply', 'complex'],
                'num_options': 4,
                'correct_ratio': 0.5
            }
        }
    
    def generate_mcqs(self, topic: str, num_questions: int = 5,
                     difficulty: str = 'medium') -> List[Dict[str, Any]]:
        """
        Generate MCQs for a given topic
        
        Args:
            topic: Topic for MCQ generation
            num_questions: Number of questions to generate
            difficulty: Difficulty level (easy, medium, hard)
        
        Returns:
            List of MCQ questions
        """
        try:
            # Support simplified RAGPipeline (no vector_store/retriever)
            if not hasattr(self.rag_pipeline, 'chunks') or not self.rag_pipeline.chunks:
                logger.info("No chunks found in RAG pipeline, using sample MCQs")
                return self._get_sample_mcqs(topic, num_questions, difficulty)

            logger.info(f"Found {len(self.rag_pipeline.chunks)} chunks in RAG pipeline")
            mcqs = []

            # Perform simple keyword-overlap retrieval on pipeline chunks
            topic_words = set(w.lower().strip('.,!?;:') for w in topic.split() if len(w.strip('.,!?;:')) > 2)
            logger.info(f"Topic words for '{topic}': {topic_words}")
            
            scored = []
            for i, chunk in enumerate(self.rag_pipeline.chunks):
                chunk_words = set(w.lower().strip('.,!?;:') for w in chunk.split() if len(w.strip('.,!?;:')) > 2)
                overlap = len(topic_words.intersection(chunk_words))
                if overlap > 0:
                    scored.append((chunk, overlap))
                    logger.info(f"Chunk {i} has overlap {overlap}: {chunk[:100]}...")

            logger.info(f"Found {len(scored)} chunks with keyword overlap")
            
            # If no exact keyword matches, try partial matching
            if not scored:
                logger.info("No exact matches, trying partial keyword matching...")
                for i, chunk in enumerate(self.rag_pipeline.chunks):
                    chunk_lower = chunk.lower()
                    for word in topic_words:
                        if word in chunk_lower:
                            scored.append((chunk, 1))
                            logger.info(f"Partial match found in chunk {i} for word '{word}': {chunk[:100]}...")
                            break
            
            if not scored:
                # fallback: take first few chunks
                relevant_chunks = self.rag_pipeline.chunks[:min(num_questions, len(self.rag_pipeline.chunks))]
                logger.info(f"No keyword overlap found, using first {len(relevant_chunks)} chunks for MCQ generation")
            else:
                scored.sort(key=lambda x: x[1], reverse=True)
                relevant_chunks = [c for c, s in scored[:min(num_questions, len(scored))]]
                logger.info(f"Using top {len(relevant_chunks)} most relevant chunks")

            # Normalize to documents with a `page_content` field for compatibility
            relevant_docs = [{'page_content': c} for c in relevant_chunks]
            
            # Generate MCQs from retrieved documents
            logger.info(f"Attempting to generate {num_questions} MCQs from {len(relevant_docs)} relevant docs")
            for i in range(min(num_questions, len(relevant_docs))):
                doc = relevant_docs[i]
                logger.info(f"Processing doc {i+1}: {doc['page_content'][:100]}...")

                # Extract key information
                sentences = doc['page_content'].split('.')
                sentences = [s.strip() for s in sentences if len(s.strip()) > 10]
                logger.info(f"Found {len(sentences)} sentences in doc {i+1}")
                
                if len(sentences) < 1:
                    logger.warning(f"No sentences found in doc {i+1}, skipping")
                    continue
                
                # Create question
                question_text = self._create_question(sentences[0], topic, difficulty)
                logger.info(f"Created question: {question_text}")
                
                # Create options
                correct_answer = self._extract_answer(sentences[0])
                options = self._generate_options(correct_answer, difficulty)
                logger.info(f"Correct answer: {correct_answer}, Options: {options}")
                
                # Shuffle options and find correct answer index
                correct_index = random.randint(0, 3)
                final_options = [''] * 4
                final_options[correct_index] = correct_answer
                
                option_indices = [j for j in range(4) if j != correct_index]
                for j, idx in enumerate(option_indices):
                    final_options[idx] = options[j]
                
                # Create MCQ
                mcq = {
                    'id': i + 1,
                    'question': question_text,
                    'options': ['A) ' + opt for opt in final_options],
                    'correct_answer': 'ABCD'[correct_index],
                    'explanation': self._generate_explanation(sentences),
                    'difficulty': difficulty,
                    'topic': topic
                }
                
                logger.info(f"Created MCQ: {mcq}")
                mcqs.append(mcq)
            
            # If not enough questions generated, add samples
            if len(mcqs) < num_questions:
                sample_mcqs = self._get_sample_mcqs(
                    topic, 
                    num_questions - len(mcqs),
                    difficulty
                )
                # Adjust IDs
                for idx, mcq in enumerate(sample_mcqs):
                    mcq['id'] = len(mcqs) + idx + 1
                mcqs.extend(sample_mcqs)
            
            return mcqs
        
        except Exception as e:
            logger.error(f"Error generating MCQs: {str(e)}")
            return self._get_sample_mcqs(topic, num_questions, difficulty)
    
    def _create_question(self, text: str, topic: str, difficulty: str) -> str:
        """
        Create a question from text
        
        Args:
            text: Source text
            topic: Question topic
            difficulty: Difficulty level
        
        Returns:
            Question text
        """
        # Extract key information from text to create meaningful questions
        text = text.strip()
        
        # Look for specific patterns in the text to create better questions
        if 'year' in text.lower() or any(char.isdigit() for char in text):
            # Extract years and create year-based questions
            import re
            years = re.findall(r'\b(19|20)\d{2}\b', text)
            if years:
                year = years[0]
                return f"In which year did the events related to {topic} take place?"
        
        # Look for names/titles (capitalized words)
        words = text.split()
        capitalized_words = [w for w in words if w[0].isupper() and len(w) > 3 and w not in ['The', 'This', 'That', 'And', 'For']]
        
        if capitalized_words:
            entity = capitalized_words[0].strip('.,!?;:')
            return f"Who was associated with {entity} in the context of {topic}?"
        
        # Look for actions/events
        action_words = ['launched', 'started', 'began', 'formed', 'created', 'passed', 'decided', 'attacked']
        for word in action_words:
            if word in text.lower():
                return f"What action was taken related to {topic} according to the text?"
        
        # Fallback to content-based questions
        if len(text) > 50:
            text = text[:50] + "..."
        
        return f"According to the text, what information is provided about {topic}?"
    
    def _extract_answer(self, text: str) -> str:
        """
        Extract potential answer from text
        
        Args:
            text: Source text
        
        Returns:
            Extracted answer
        """
        # Look for specific information in the text
        text = text.strip()
        
        # Extract years as answers
        import re
        years = re.findall(r'\b(19|20)\d{2}\b', text)
        if years:
            return years[0]
        
        # Extract names/titles (capitalized words)
        words = text.split()
        capitalized_words = [w for w in words if w[0].isupper() and len(w) > 3 and w not in ['The', 'This', 'That', 'And', 'For', 'Government', 'Department']]
        if capitalized_words:
            return capitalized_words[0].strip('.,!?;:')
        
        # Extract key phrases with numbers
        for i, word in enumerate(words):
            if word.isdigit() and i > 0:
                return f"{words[i-1]} {word}"
        
        # Extract meaningful phrases (2-3 consecutive words)
        if len(words) >= 3:
            return ' '.join(words[:3])
        elif len(words) >= 2:
            return ' '.join(words[:2])
        
        return text[:30] if len(text) > 30 else text
    
    def _generate_options(self, correct_answer: str, 
                         difficulty: str) -> List[str]:
        """
        Generate wrong options for MCQ
        
        Args:
            correct_answer: Correct answer
            difficulty: Difficulty level
        
        Returns:
            List of wrong options
        """
        options = [
            "A common misconception is that the answer is related to error handling",
            "The answer could be a basic implementation detail without optimization",
            "None of the above or all of the above options could be correct",
            "The answer requires advanced knowledge beyond the basic concept"
        ]
        
        return random.sample(options, 3)
    
    def _generate_explanation(self, sentences: List[str]) -> str:
        """
        Generate explanation for the correct answer
        
        Args:
            sentences: Source sentences
        
        Returns:
            Explanation text
        """
        if sentences:
            explanation = sentences[0]
            if len(explanation) > 200:
                explanation = explanation[:200] + "..."
            return explanation
        
        return "This answer is correct based on the subject matter covered in the uploaded documents."
    
    def _get_sample_mcqs(self, topic: str, num_questions: int,
                        difficulty: str) -> List[Dict[str, Any]]:
        """
        Get sample MCQs when no documents are uploaded
        
        Args:
            topic: Question topic
            num_questions: Number of questions
            difficulty: Difficulty level
        
        Returns:
            List of sample MCQs
        """
        sample_bank = {
            'Banking': [
                {
                    'question': 'What is the primary role of a central bank?',
                    'options': [
                        'A) Manage currency and monetary policy',
                        'B) Provide retail banking services',
                        'C) Offer insurance products',
                        'D) Manage personal investments'
                    ],
                    'correct_answer': 'A',
                    'explanation': 'Central banks manage a country\'s monetary policy, issue currency, and regulate financial institutions.'
                },
                {
                    'question': 'Which banking regulation ensures customer deposits are protected?',
                    'options': [
                        'A) Basel III',
                        'B) Deposit Insurance Scheme',
                        'C) Know Your Customer',
                        'D) Anti-Money Laundering'
                    ],
                    'correct_answer': 'B',
                    'explanation': 'Deposit Insurance Schemes protect customer deposits in case of bank failure.'
                }
            ],
            'Railways': [
                {
                    'question': 'What is the gauge of Indian Railway tracks?',
                    'options': [
                        'A) 750 mm',
                        'B) 1000 mm',
                        'C) 1676 mm',
                        'D) 2000 mm'
                    ],
                    'correct_answer': 'C',
                    'explanation': 'Indian Railways predominantly use 1676 mm broad gauge tracks.'
                },
                {
                    'question': 'Which zone has the highest number of railway routes in India?',
                    'options': [
                        'A) Central Railway',
                        'B) Northern Railway',
                        'C) Southern Railway',
                        'D) Eastern Railway'
                    ],
                    'correct_answer': 'B',
                    'explanation': 'Northern Railway operates the most extensive network in Indian Railways.'
                }
            ],
            'History': [
                {
                    'question': 'In which year did World War II end?',
                    'options': [
                        'A) 1943',
                        'B) 1944',
                        'C) 1945',
                        'D) 1946'
                    ],
                    'correct_answer': 'C',
                    'explanation': 'World War II ended in 1945 with the surrender of Japan in August and Germany in May.'
                },
                {
                    'question': 'Who was the first Prime Minister of independent India?',
                    'options': [
                        'A) Sardar Vallabhbhai Patel',
                        'B) Jawaharlal Nehru',
                        'C) Mahatma Gandhi',
                        'D) Dr. B.R. Ambedkar'
                    ],
                    'correct_answer': 'B',
                    'explanation': 'Jawaharlal Nehru became the first Prime Minister of independent India on August 15, 1947.'
                },
                {
                    'question': 'The ancient civilization of Indus Valley flourished around which river?',
                    'options': [
                        'A) Ganges',
                        'B) Yamuna',
                        'C) Indus',
                        'D) Brahmaputra'
                    ],
                    'correct_answer': 'C',
                    'explanation': 'The Indus Valley civilization developed around the Indus River and its tributaries.'
                }
            ],
            'Geography': [
                {
                    'question': 'Which is the largest continent by area?',
                    'options': [
                        'A) Africa',
                        'B) Asia',
                        'C) North America',
                        'D) South America'
                    ],
                    'correct_answer': 'B',
                    'explanation': 'Asia is the largest continent, covering about 30% of Earth\'s land area.'
                },
                {
                    'question': 'What is the capital of Australia?',
                    'options': [
                        'A) Sydney',
                        'B) Melbourne',
                        'C) Canberra',
                        'D) Perth'
                    ],
                    'correct_answer': 'C',
                    'explanation': 'Canberra is the capital city of Australia, though it\'s not the largest city.'
                }
            ],
            'Laws': [
                {
                    'question': 'Who is considered the Father of the Indian Constitution?',
                    'options': [
                        'A) Mahatma Gandhi',
                        'B) Jawaharlal Nehru',
                        'C) Dr. B.R. Ambedkar',
                        'D) Sardar Patel'
                    ],
                    'correct_answer': 'C',
                    'explanation': 'Dr. B.R. Ambedkar was the chairman of the drafting committee and is known as the Father of the Indian Constitution.'
                },
                {
                    'question': 'The Fundamental Rights in Indian Constitution are inspired by which country?',
                    'options': [
                        'A) United Kingdom',
                        'B) United States',
                        'C) France',
                        'D) Canada'
                    ],
                    'correct_answer': 'B',
                    'explanation': 'The Fundamental Rights in the Indian Constitution are inspired by the Bill of Rights of the United States.'
                }
            ],
            'General': [
                {
                    'question': 'What is the national animal of India?',
                    'options': [
                        'A) Lion',
                        'B) Tiger',
                        'C) Elephant',
                        'D) Peacock'
                    ],
                    'correct_answer': 'B',
                    'explanation': 'The Bengal Tiger is the national animal of India.'
                },
                {
                    'question': 'Which festival is known as the Festival of Lights?',
                    'options': [
                        'A) Holi',
                        'B) Diwali',
                        'C) Dussehra',
                        'D) Eid'
                    ],
                    'correct_answer': 'B',
                    'explanation': 'Diwali is known as the Festival of Lights and is one of the major Hindu festivals.'
                }
            ]
        }
        
        # Get sample questions for the topic
        samples = sample_bank.get(topic, [])
        
        mcqs = []
        for i in range(min(num_questions, len(samples))):
            sample = samples[i]
            mcq = {
                'id': i + 1,
                'question': sample['question'],
                'options': sample['options'],
                'correct_answer': sample['correct_answer'],
                'explanation': sample['explanation'],
                'difficulty': difficulty,
                'topic': topic
            }
            mcqs.append(mcq)
        
        return mcqs
