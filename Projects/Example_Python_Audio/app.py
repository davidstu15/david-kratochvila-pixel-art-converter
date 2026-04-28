from flask import Flask, request, jsonify

app = Flask(__name__)

@app.route('/api/process-audio', methods=['POST'])
def process_audio():
    if 'audio' not in request.files:
        return jsonify({'error': 'No file part'}), 400
    
    file = request.files['audio']
    if file.filename == '':
        return jsonify({'error': 'No file selected'}), 400
        
    # Example processing
    return jsonify({
        'message': 'Audio processed successfully!',
        'filename': file.filename,
        'format': 'wav'
    })

if __name__ == '__main__':
    # Run on a different port than the main portal
    app.run(port=5001, debug=True)
