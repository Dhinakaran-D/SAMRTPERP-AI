"""
RAG Pipeline Implementation - Simplified
Handles PDF processing and document retrieval without complex LangChain dependencies
"""

import os
import logging
from typing import List, Dict, Any
import PyPDF2

logger = logging.getLogger(__name__)

class RAGPipeline:
    """Retrieval Augmented Generation Pipeline - Simplified Version"""
    
    def __init__(self):
        """Initialize RAG pipeline components"""
        self.documents = {}  # Store document metadata
        self.chunks = []  # Store text chunks
        self.retrieved_chunks = []
        self.upload_folder = '../uploads'
        logger.info("RAG Pipeline initialized (simplified mode without LangChain)")
        self._load_existing_pdfs()
    
    def _load_existing_pdfs(self):
        """Load existing PDFs from uploads folder"""
        try:
            if not os.path.exists(self.upload_folder):
                logger.info(f"Uploads folder {self.upload_folder} does not exist")
                return
            
            pdf_files = [f for f in os.listdir(self.upload_folder) if f.endswith('.pdf')]
            logger.info(f"Found {len(pdf_files)} existing PDF files")
            
            for pdf_file in pdf_files:
                filepath = os.path.join(self.upload_folder, pdf_file)
                # Try to determine category from filename or default to General
                category = "Others"
                filename_lower = pdf_file.lower()
                
                if "bank" in filename_lower:
                    category = "Banking"
                elif "railway" in filename_lower:
                    category = "Railways"
                elif "history" in filename_lower or "war" in filename_lower:
                    category = "History"
                elif "geography" in filename_lower:
                    category = "Geography"
                elif "law" in filename_lower or "constitution" in filename_lower:
                    category = "Laws"
                elif "science" in filename_lower or "physics" in filename_lower or "chemistry" in filename_lower or "biology" in filename_lower:
                    category = "Science"
                elif "math" in filename_lower or "calculus" in filename_lower or "algebra" in filename_lower:
                    category = "Mathematics"
                elif "english" in filename_lower or "literature" in filename_lower or "grammar" in filename_lower:
                    category = "English"
                elif "affair" in filename_lower or "current" in filename_lower or "news" in filename_lower:
                    category = "Current Affairs"
                elif "econom" in filename_lower or "trade" in filename_lower or "commerce" in filename_lower:
                    category = "Economics"
                elif "politic" in filename_lower or "governance" in filename_lower:
                    category = "Politics"
                elif "computer" in filename_lower or "programming" in filename_lower or "code" in filename_lower or "software" in filename_lower or "it" in filename_lower:
                    category = "Computer Science"
                elif "literary" in filename_lower or "poem" in filename_lower or "novel" in filename_lower or "short story" in filename_lower:
                    category = "Literature"
                elif "art" in filename_lower or "culture" in filename_lower or "music" in filename_lower or "dance" in filename_lower or "painting" in filename_lower:
                    category = "Art & Culture"
                elif "sport" in filename_lower or "game" in filename_lower or "athletic" in filename_lower or "cricket" in filename_lower or "football" in filename_lower:
                    category = "Sports"
                elif "environment" in filename_lower or "ecology" in filename_lower or "climate" in filename_lower or "pollution" in filename_lower:
                    category = "Environment"
                elif "tech" in filename_lower or "innovation" in filename_lower or "digital" in filename_lower:
                    category = "Technology"
                
                logger.info(f"Loading existing PDF: {pdf_file} as {category}")
                self.add_pdf(filepath, category)
                
        except Exception as e:
            logger.error(f"Error loading existing PDFs: {str(e)}")
    
    def _extract_text_from_pdf(self, filepath: str) -> str:
        """
        Extract text from PDF file
        
        Args:
            filepath: Path to PDF file
        
        Returns:
            Extracted text from PDF
        """
        try:
            text = ""
            with open(filepath, 'rb') as file:
                pdf_reader = PyPDF2.PdfReader(file)
                logger.info(f"PDF has {len(pdf_reader.pages)} pages")
                
                for page_num, page in enumerate(pdf_reader.pages):
                    try:
                        text += page.extract_text()
                    except Exception as e:
                        logger.warning(f"Error extracting page {page_num}: {str(e)}")
            
            return text
        except Exception as e:
            logger.error(f"Error extracting text from PDF: {str(e)}")
            return ""
    
    def _chunk_text(self, text: str, chunk_size: int = 500, 
                    chunk_overlap: int = 50) -> List[str]:
        """
        Split text into chunks for retrieval
        
        Args:
            text: Text to chunk
            chunk_size: Size of each chunk
            chunk_overlap: Overlap between chunks
        
        Returns:
            List of text chunks
        """
        chunks = []
        start = 0
        
        # Split by sentences first
        sentences = text.replace('?', '.').replace('!', '.').split('.')
        current_chunk = ""
        
        for sentence in sentences:
            sentence = sentence.strip()
            if not sentence:
                continue
                
            if len(current_chunk) + len(sentence) < chunk_size:
                current_chunk += " " + sentence if current_chunk else sentence
            else:
                if current_chunk:
                    chunks.append(current_chunk.strip())
                current_chunk = sentence
        
        if current_chunk:
            chunks.append(current_chunk.strip())
        
        logger.info(f"Text split into {len(chunks)} chunks")
        return chunks
    
    def add_pdf(self, filepath: str, category: str = "General") -> bool:
        """
        Add PDF to RAG pipeline
        
        Args:
            filepath: Path to PDF file
            category: Category of the PDF (e.g., "Banking", "Railways")
        
        Returns:
            True if successful, False otherwise
        """
        try:
            filename = os.path.basename(filepath)
            logger.info(f"Processing PDF: {filename}")
            
            # Extract text
            text = self._extract_text_from_pdf(filepath)
            if not text.strip():
                logger.error(f"No text extracted from {filename}")
                return False
            
            # Chunk text
            chunks = self._chunk_text(text)
            
            # Store document metadata
            self.documents[filename] = {
                'filepath': filepath,
                'category': category,
                'num_chunks': len(chunks),
                'text_length': len(text)
            }
            
            # Store chunks
            self.chunks.extend(chunks)
            self.retrieved_chunks = chunks  # Make all chunks available for search
            
            logger.info(f"Successfully added {filename} with {len(chunks)} chunks")
            return True
        
        except Exception as e:
            logger.error(f"Error adding PDF: {str(e)}")
            return False
    
    def answer_question(self, question: str, 
                       chat_history: List[Dict] = None) -> str:
        """
        Answer a question using simple text retrieval
        
        Args:
            question: User's question
            chat_history: Previous chat messages
        
        Returns:
            Answer to the question
        """
        try:
            if not self.chunks:
                return (
                    "No documents uploaded yet. Please upload PDFs first to ask questions. "
                    "Go to 'Upload PDFs' section and add exam materials."
                )
            
            # Simple keyword matching for retrieval
            question_words = set(word.lower() for word in question.split() if len(word) > 3)
            scored_chunks = []
            
            for chunk in self.chunks:
                chunk_words = set(word.lower() for word in chunk.split() if len(word) > 3)
                # Calculate overlap score
                overlap = len(question_words.intersection(chunk_words))
                if overlap > 0:
                    scored_chunks.append((chunk, overlap))
            
            # Get top 3 matching chunks
            if not scored_chunks:
                # If no keyword match, return first chunks
                relevant_docs = self.chunks[:3]
            else:
                scored_chunks.sort(key=lambda x: x[1], reverse=True)
                relevant_docs = [chunk for chunk, score in scored_chunks[:3]]
            
            # Create context from retrieved documents
            context = "\n".join(relevant_docs)
            
            # Generate simple answer
            answer = self._generate_simple_answer(question, context)
            return answer
        
        except Exception as e:
            logger.error(f"Error answering question: {str(e)}")
            return f"An error occurred while processing your question: {str(e)}"
    
    def _generate_simple_answer(self, question: str, context: str) -> str:
        """
        Generate a simple answer based on context
        
        Args:
            question: User's question
            context: Retrieved context
        
        Returns:
            Simple answer
        """
        # Extract sentences from context
        sentences = [s.strip() for s in context.split('.') if s.strip() and len(s.strip()) > 20]
        
        if sentences:
            # Return first few sentences as answer
            answer = '. '.join(sentences[:2]) + '.'
            if len(answer) > 500:
                answer = answer[:500] + '...'
        else:
            answer = context[:300] + "..." if len(context) > 300 else context
        
        return answer if answer else "No relevant information found in the documents."
    
    def get_documents_info(self) -> List[Dict[str, Any]]:
        """
        Get information about uploaded documents
        
        Returns:
            List of document information
        """
        return [
            {
                'name': name,
                'category': info['category'],
                'chunks': info['num_chunks'],
                'size': info['text_length']
            }
            for name, info in self.documents.items()
        ]
    
    def clear_database(self):
        """Clear all documents"""
        self.documents = {}
        self.chunks = []
        self.retrieved_chunks = []
        logger.info("Database cleared")
    
    def remove_document(self, filename: str) -> bool:
        """
        Remove a specific document from the RAG pipeline
        
        Args:
            filename: Name of the document to remove
        
        Returns:
            True if document was removed, False otherwise
        """
        if filename in self.documents:
            # Get the chunks count for logging
            removed_chunks = self.documents[filename].get('num_chunks', 0)
            
            # Remove document metadata
            del self.documents[filename]
            
            # Rebuild chunks list (remove chunks from this document)
            # This is a simplified approach - rebuild all chunks
            self.chunks = []
            self.retrieved_chunks = []
            
            # Re-add chunks from remaining documents
            for doc_name, doc_info in self.documents.items():
                if 'chunks' in doc_info:
                    self.chunks.extend(doc_info['chunks'])
            
            logger.info(f"Removed document: {filename} ({removed_chunks} chunks)")
            return True
        else:
            logger.warning(f"Document not found: {filename}")
            return False
