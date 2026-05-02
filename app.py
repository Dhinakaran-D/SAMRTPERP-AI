"""
Flask Backend for SmartPrep AI RAG Application
Handles PDF uploads, chat queries, and MCQ generation
"""

from flask import Flask, request, jsonify, send_from_directory
from flask_cors import CORS
import os
from werkzeug.utils import secure_filename
import logging
from rag_pipeline import RAGPipeline
from mcq_generator import MCQGenerator
from gemini_mcq_generator import GeminiMCQGenerator
from ollama_mcq_generator import OllamaMCQGenerator
from ollama_chat import OllamaChat

# Initialize Flask app
app = Flask(__name__)
CORS(app)

# Configuration
BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
UPLOAD_FOLDER = os.path.join(BASE_DIR, 'uploads')
FRONTEND_FOLDER = os.path.join(BASE_DIR, 'frontend')
ALLOWED_EXTENSIONS = {'pdf'}
MAX_FILE_SIZE = 50 * 1024 * 1024  # 50 MB

# Ensure upload folder exists
os.makedirs(UPLOAD_FOLDER, exist_ok=True)
app.config['UPLOAD_FOLDER'] = UPLOAD_FOLDER
app.config['MAX_CONTENT_LENGTH'] = MAX_FILE_SIZE

# Setup logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Initialize RAG pipeline and generators
rag_pipeline = RAGPipeline()
mcq_generator = MCQGenerator(rag_pipeline)

# Mode configuration: 'online' (Gemini) or 'offline' (Ollama)
current_mode = 'online'  # Default to online mode

# Initialize online mode (Gemini)
try:
    gemini_mcq_generator = GeminiMCQGenerator(rag_pipeline)
    logger.info("✓ Gemini (Online) mode initialized")
except Exception as e:
    gemini_mcq_generator = None
    logger.warning(f"✗ Gemini initialization failed: {str(e)}")

# Initialize offline mode (Ollama)
try:
    ollama_mcq_generator = OllamaMCQGenerator(rag_pipeline)
    ollama_chat = OllamaChat(rag_pipeline)
    logger.info("✓ Ollama (Offline) mode initialized")
except Exception as e:
    ollama_mcq_generator = None
    ollama_chat = None
    logger.warning(f"✗ Ollama initialization failed: {str(e)}")

def allowed_file(filename):
    """Check if file has allowed extension"""
    return '.' in filename and filename.rsplit('.', 1)[1].lower() in ALLOWED_EXTENSIONS

@app.route('/api/health', methods=['GET'])
def health_check():
    """Health check endpoint"""
    return jsonify({
        'status': 'ok',
        'message': 'SmartPrep AI Backend is running',
        'mode': current_mode,
        'gemini_available': gemini_mcq_generator is not None,
        'ollama_available': ollama_mcq_generator is not None
    })

@app.route('/api/mode', methods=['GET'])
def get_mode():
    """Get current mode"""
    return jsonify({
        'mode': current_mode,
        'gemini_available': gemini_mcq_generator is not None,
        'ollama_available': ollama_mcq_generator is not None
    })

@app.route('/api/mode', methods=['POST'])
def set_mode():
    """Set mode (online/offline)"""
    global current_mode
    try:
        data = request.get_json()
        new_mode = data.get('mode', 'online')
        
        if new_mode not in ['online', 'offline']:
            return jsonify({'error': 'Mode must be "online" or "offline"'}), 400
        
        if new_mode == 'online' and not gemini_mcq_generator:
            return jsonify({'error': 'Gemini (online mode) is not available'}), 400
        
        if new_mode == 'offline' and not ollama_mcq_generator:
            return jsonify({'error': 'Ollama (offline mode) is not available. Please install and start Ollama.'}), 400
        
        current_mode = new_mode
        logger.info(f"Mode switched to: {current_mode}")
        
        return jsonify({
            'status': 'success',
            'mode': current_mode,
            'message': f'Switched to {current_mode} mode'
        })
    except Exception as e:
        logger.error(f"Error setting mode: {str(e)}")
        return jsonify({'error': str(e)}), 500

@app.route('/api/upload-pdf', methods=['POST'])
def upload_pdf():
    """
    Upload PDF file and add to RAG pipeline
    Expected: multipart/form-data with 'pdf_file' and 'category' fields
    """
    try:
        # Check if file is in request
        if 'pdf_file' not in request.files:
            return jsonify({'error': 'No PDF file provided'}), 400
        
        file = request.files['pdf_file']
        category = request.form.get('category', 'General')
        
        if file.filename == '':
            return jsonify({'error': 'No file selected'}), 400
        
        if not allowed_file(file.filename):
            return jsonify({'error': 'Only PDF files are allowed'}), 400
        
        # Save file
        filename = secure_filename(file.filename)
        filepath = os.path.join(app.config['UPLOAD_FOLDER'], filename)
        file.save(filepath)
        
        # Process PDF with RAG pipeline
        success = rag_pipeline.add_pdf(filepath, category)
        
        if success:
            return jsonify({
                'status': 'success',
                'message': f'PDF uploaded successfully: {filename}',
                'filename': filename,
                'category': category
            }), 200
        else:
            return jsonify({'error': 'Failed to process PDF'}), 500
    
    except Exception as e:
        logger.error(f"Error uploading PDF: {str(e)}")
        return jsonify({'error': f'An error occurred: {str(e)}'}), 500

@app.route('/api/chat', methods=['POST'])
def chat():
    """
    Chat endpoint - answer questions based on uploaded PDFs
    Expected JSON: {'question': 'user question', 'chat_history': []}
    """
    try:
        data = request.get_json()
        
        if not data or 'question' not in data:
            return jsonify({'error': 'Question is required'}), 400
        
        question = data.get('question', '').strip()
        chat_history = data.get('chat_history', [])
        
        if not question:
            return jsonify({'error': 'Question cannot be empty'}), 400
        
        # Generate response based on current mode
        if current_mode == 'offline' and ollama_chat:
            logger.info("Using Ollama (offline) for chat")
            response = ollama_chat.answer_question(question, chat_history)
        else:
            logger.info("Using RAG pipeline (online) for chat")
            response = rag_pipeline.answer_question(question, chat_history)
        
        return jsonify({
            'status': 'success',
            'answer': response,
            'question': question,
            'mode': current_mode
        }), 200
    
    except Exception as e:
        logger.error(f"Error in chat: {str(e)}")
        return jsonify({'error': f'An error occurred: {str(e)}'}), 500

@app.route('/api/generate-mcqs', methods=['POST'])
def generate_mcqs():
    """
    Generate MCQs from uploaded documents
    Expected JSON: {'topic': 'topic name', 'num_questions': 5, 'difficulty': 'medium'}
    """
    try:
        data = request.get_json()
        
        if not data or 'topic' not in data:
            return jsonify({'error': 'Topic is required'}), 400
        
        topic = data.get('topic', '').strip()
        num_questions = int(data.get('num_questions', 5))
        difficulty = data.get('difficulty', 'medium')
        
        if not topic:
            return jsonify({'error': 'Topic cannot be empty'}), 400
        
        if num_questions < 1 or num_questions > 25:
            return jsonify({'error': 'Number of questions must be between 1 and 25'}), 400
        
        # Generate MCQs based on current mode
        mcqs = []
        
        logger.info(f"Starting MCQ generation: topic='{topic}', num_questions={num_questions}, difficulty='{difficulty}', mode='{current_mode}'")
        logger.info(f"Available generators: gemini={gemini_mcq_generator is not None}, ollama={ollama_mcq_generator is not None}")
        logger.info(f"RAG Pipeline chunks available: {len(rag_pipeline.chunks) if hasattr(rag_pipeline, 'chunks') else 0}")
        
        if current_mode == 'offline' and ollama_mcq_generator:
            logger.info("Using Ollama (offline) for MCQ generation")
            mcqs = ollama_mcq_generator.generate_mcqs(topic, num_questions, difficulty)
            logger.info(f"Ollama returned {len(mcqs)} MCQs")
        elif current_mode == 'online' and gemini_mcq_generator:
            logger.info("Using Gemini (online) for MCQ generation")
            mcqs = gemini_mcq_generator.generate_mcqs(topic, num_questions, difficulty)
            logger.info(f"Gemini returned {len(mcqs)} MCQs")
        
        # Fallback to regular generator if both fail
        if not mcqs:
            logger.warning("Primary generator failed, falling back to basic generator")
            mcqs = mcq_generator.generate_mcqs(topic, num_questions, difficulty)
            logger.info(f"Basic generator returned {len(mcqs)} MCQs")
        
        return jsonify({
            'status': 'success',
            'mcqs': mcqs,
            'count': len(mcqs),
            'topic': topic,
            'difficulty': difficulty,
            'mode': current_mode
        }), 200
    
    except Exception as e:
        logger.error(f"Error generating MCQs: {str(e)}")
        return jsonify({'error': f'An error occurred: {str(e)}'}), 500

@app.route('/api/debug/chunks', methods=['GET'])
def debug_chunks():
    """Debug endpoint to see chunks content"""
    try:
        chunks = rag_pipeline.chunks
        return jsonify({
            'status': 'success',
            'total_chunks': len(chunks),
            'first_few_chunks': chunks[:3] if chunks else [],
            'chunk_sample': chunks[0][:200] + '...' if chunks and len(chunks[0]) > 200 else (chunks[0] if chunks else 'No chunks')
        }), 200
    except Exception as e:
        logger.error(f"Error in debug chunks: {str(e)}")
        return jsonify({'error': f'An error occurred: {str(e)}'}), 500

@app.route('/api/documents', methods=['GET'])
def get_documents():
    """Get list of uploaded documents and their info"""
    try:
        documents = rag_pipeline.get_documents_info()
        return jsonify({
            'status': 'success',
            'documents': documents,
            'total': len(documents)
        }), 200
    
    except Exception as e:
        logger.error(f"Error getting documents: {str(e)}")
        return jsonify({'error': f'An error occurred: {str(e)}'}), 500

@app.route('/api/clear-database', methods=['POST'])
def clear_database():
    """Clear all documents from RAG pipeline"""
    try:
        rag_pipeline.clear_database()
        return jsonify({
            'status': 'success',
            'message': 'Database cleared successfully'
        }), 200
    
    except Exception as e:
        logger.error(f"Error clearing database: {str(e)}")
        return jsonify({'error': f'An error occurred: {str(e)}'}), 500

@app.route('/api/delete-document', methods=['POST'])
def delete_document():
    """Delete a specific document from RAG pipeline"""
    try:
        data = request.get_json()
        
        if not data or 'filename' not in data:
            return jsonify({'error': 'Filename is required'}), 400
        
        filename = data.get('filename', '').strip()
        
        if not filename:
            return jsonify({'error': 'Filename cannot be empty'}), 400
        
        # Remove from RAG pipeline
        success = rag_pipeline.remove_document(filename)
        
        # Also try to delete the physical file
        try:
            filepath = os.path.join(app.config['UPLOAD_FOLDER'], secure_filename(filename))
            if os.path.exists(filepath):
                os.remove(filepath)
                logger.info(f"Deleted file: {filepath}")
        except Exception as e:
            logger.warning(f"Could not delete file: {str(e)}")
        
        if success:
            return jsonify({
                'status': 'success',
                'message': f'Document deleted successfully: {filename}'
            }), 200
        else:
            return jsonify({
                'status': 'success',
                'message': f'Document removed from database: {filename}'
            }), 200
    
    except Exception as e:
        logger.error(f"Error deleting document: {str(e)}")
        return jsonify({'error': f'An error occurred: {str(e)}'}), 500

@app.route('/', methods=['GET'])
def serve_frontend():
    """Serve frontend HTML"""
    return open(os.path.join(FRONTEND_FOLDER, 'index.html'), encoding='utf-8').read(), 200, {'Content-Type': 'text/html'}

@app.route('/style.css', methods=['GET'])
def serve_css():
    """Serve CSS file"""
    return open(os.path.join(FRONTEND_FOLDER, 'style.css'), encoding='utf-8').read(), 200, {'Content-Type': 'text/css'}

@app.route('/script.js', methods=['GET'])
def serve_js():
    """Serve JavaScript file"""
    return open(os.path.join(FRONTEND_FOLDER, 'script.js'), encoding='utf-8').read(), 200, {'Content-Type': 'application/javascript'}

@app.route('/uploads/<filename>', methods=['GET'])
def serve_pdf(filename):
    """Serve uploaded PDF files"""
    try:
        safe_filename = secure_filename(filename)
        file_path = os.path.join(app.config['UPLOAD_FOLDER'], safe_filename)
        
        # Verify file exists and is within upload folder
        if not os.path.exists(file_path):
            logger.warning(f"File not found: {file_path}")
            return jsonify({'error': 'File not found'}), 404
        
        # Verify file is actually in upload folder (security check)
        real_path = os.path.realpath(file_path)
        upload_path = os.path.realpath(app.config['UPLOAD_FOLDER'])
        if not real_path.startswith(upload_path):
            logger.warning(f"Security: Attempted to access file outside upload folder")
            return jsonify({'error': 'Access denied'}), 403
        
        with open(file_path, 'rb') as f:
            file_content = f.read()
        
        return file_content, 200, {
            'Content-Type': 'application/pdf',
            'Content-Disposition': f'inline; filename="{safe_filename}"'
        }
    except Exception as e:
        logger.error(f"Error serving PDF: {str(e)}")
        return jsonify({'error': 'File access error'}), 500

@app.route('/favicon.ico', methods=['GET'])
def serve_favicon():
    """Serve favicon"""
    try:
        return open(os.path.join(FRONTEND_FOLDER, 'favicon.ico'), 'rb').read(), 200, {'Content-Type': 'image/x-icon'}
    except FileNotFoundError:
        return '', 404

if __name__ == '__main__':
    logger.info("Starting SmartPrep AI Backend Server...")
    app.run(debug=False, host='0.0.0.0', port=5000, use_reloader=False)
