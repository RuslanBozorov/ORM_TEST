"""
OMR Backend Server
Flask server for processing OMR answer sheets
"""

from flask import Flask, request, jsonify
from flask_cors import CORS
from api.omr_routes import omr_bp
import os

app = Flask(__name__)

# CORS - frontend bilan ishlash uchun
CORS(app, resources={
    r"/api/*": {
        "origins": ["http://localhost:5173", "http://localhost:3000"],
        "methods": ["POST", "OPTIONS"],
        "allow_headers": ["Content-Type"]
    }
})

# Blueprint register qilish
app.register_blueprint(omr_bp)

@app.route('/api/health', methods=['GET'])
def health_check():
    """Server ishlashini tekshirish"""
    return jsonify({"status": "ok", "message": "OMR Server is running"})

if __name__ == '__main__':
    print("=" * 50)
    print("OMR Server ishga tushmoqda...")
    print("Port: 5000")
    print("API: http://localhost:5000/api/omr/process")
    print("=" * 50)
    
    app.run(
        host='0.0.0.0',
        port=5000,
        debug=True
    )
