"""
OMR Processing API
- Rasmni qabul qiladi
- OpenCV bilan processing qiladi
- Javoblarni aniqlaydi
- Natijani JSON formatda qaytaradi
"""

from flask import Blueprint, request, jsonify
import cv2
import numpy as np
import base64
import io
from PIL import Image

omr_bp = Blueprint('omr', __name__)


def find_corners(gray):
    """4 ta qora burchak markerlarini topish"""
    blurred = cv2.GaussianBlur(gray, (5, 5), 0)
    
    # Qora ranglarni threshold
    _, thresh = cv2.threshold(blurred, 40, 255, cv2.THRESH_BINARY_INV)
    
    contours, _ = cv2.findContours(thresh, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
    
    candidates = []
    for contour in contours:
        area = cv2.contourArea(contour)
        if 500 < area < 50000:
            peri = cv2.arcLength(contour, True)
            approx = cv2.approxPolyDP(contour, 0.03 * peri, True)
            
            if len(approx) == 4:
                candidates.append(approx)
    
    # Eng katta 4 tasini tanlash
    if len(candidates) >= 4:
        candidates = sorted(candidates, key=cv2.contourArea, reverse=True)[:4]
        return [c.reshape(4, 2) for c in candidates]
    
    return []


def order_points(pts):
    """4 ta nuqtani TL, TR, BR, BL tartibida sortlash"""
    rect = np.zeros((4, 2), dtype="float32")
    
    s = pts.sum(axis=1)
    rect[0] = pts[np.argmin(s)]  # TL
    rect[2] = pts[np.argmax(s)]  # BR
    
    diff = np.diff(pts, axis=1)
    rect[1] = pts[np.argmin(diff)]  # TR
    rect[3] = pts[np.argmax(diff)]  # BL
    
    return rect


def warp_perspective(image, corners):
    """Perspektivani to'g'rilash"""
    pts = np.array(corners, dtype="float32")
    ordered = order_points(pts)
    (tl, tr, br, bl) = ordered
    
    widthA = np.sqrt(((br[0] - bl[0]) ** 2) + ((br[1] - bl[1]) ** 2))
    widthB = np.sqrt(((tr[0] - tl[0]) ** 2) + ((tr[1] - tl[1]) ** 2))
    maxWidth = max(int(widthA), int(widthB))
    
    heightA = np.sqrt(((tr[0] - br[0]) ** 2) + ((tr[1] - br[1]) ** 2))
    heightB = np.sqrt(((tl[0] - bl[0]) ** 2) + ((tl[1] - bl[1]) ** 2))
    maxHeight = max(int(heightA), int(heightB))
    
    dst = np.array([
        [0, 0],
        [maxWidth - 1, 0],
        [maxWidth - 1, maxHeight - 1],
        [0, maxHeight - 1]], dtype="float32")
    
    M = cv2.getPerspectiveTransform(ordered, dst)
    warped = cv2.warpPerspective(image, M, (maxWidth, maxHeight))
    
    return warped


def detect_answers(warped, subjects):
    """Javob katakchalarini aniqlash"""
    gray = cv2.cvtColor(warped, cv2.COLOR_RGB2GRAY)
    _, thresh = cv2.threshold(gray, 100, 255, cv2.THRESH_BINARY_INV)
    
    height, width = gray.shape
    answers = {}
    total_detected = 0
    total_possible = 0
    
    # Layout parametrlari
    margin_top = int(height * 0.1)
    margin_bottom = int(height * 0.95)
    margin_left = int(width * 0.05)
    margin_right = int(width * 0.95)
    
    for sub_idx, sub in enumerate(subjects):
        for sec_idx, sec in enumerate(sub.get('sections', [])):
            section_key = f"{sub_idx}-{sec_idx}"
            answers[section_key] = {}
            
            question_count = sec.get('question_count', 0)
            question_type = sec.get('question_type', 'mcq4')
            total_possible += question_count
            
            # Variantlar soni
            if question_type == 'mcq5':
                opts = 5
            elif question_type == 'mcq4':
                opts = 4
            elif question_type == 'true_false':
                opts = 2
            else:
                opts = 0
            
            # Grid hisoblash
            section_height = (margin_bottom - margin_top) // max(len(sub.get('sections', [])), 1)
            questions_per_row = min(question_count, 20)
            rows_count = int(np.ceil(question_count / questions_per_row))
            cell_height = section_height // (rows_count + 1)
            cell_width = (margin_right - margin_left) // (opts + 1)
            
            for q in range(question_count):
                row = q // questions_per_row
                col = q % questions_per_row
                
                y = margin_top + row * cell_height + int(cell_height * 0.3)
                best_option = {"letter": "", "confidence": 0}
                
                for opt in range(opts):
                    x = margin_left + (opt + 1) * cell_width
                    bubble_r = int(cell_width * 0.25)
                    
                    # Doira ichidagi piksellarni sanash
                    mask = np.zeros_like(thresh)
                    cv2.circle(mask, (x, y), bubble_r, 255, -1)
                    
                    filled_pixels = cv2.countNonZero(cv2.bitwise_and(thresh, mask))
                    total_pixels = cv2.countNonZero(mask)
                    
                    fill_ratio = filled_pixels / total_pixels if total_pixels > 0 else 0
                    
                    # Harf belgilash
                    if question_type == 'true_false':
                        letter = "T" if opt == 0 else "F"
                    else:
                        letter = chr(65 + opt)  # A, B, C, D, E
                    
                    if fill_ratio > best_option["confidence"]:
                        best_option = {"letter": letter, "confidence": fill_ratio}
                
                # Agar to'ldirilgan bo'lsa
                if best_option["confidence"] > 0.3:
                    answers[section_key][str(q)] = best_option["letter"]
                    total_detected += 1
    
    confidence = total_detected / total_possible if total_possible > 0 else 0
    
    return {
        "answers": answers,
        "totalDetected": total_detected,
        "confidence": confidence
    }


def draw_result_overlay(warped, answers, subjects):
    """Natijani vizual ko'rsatish"""
    result = warped.copy()
    height, width, _ = result.shape
    
    margin_top = int(height * 0.1)
    margin_bottom = int(height * 0.95)
    margin_left = int(width * 0.05)
    margin_right = int(width * 0.95)
    
    for sub_idx, sub in enumerate(subjects):
        for sec_idx, sec in enumerate(sub.get('sections', [])):
            section_key = f"{sub_idx}-{sec_idx}"
            question_count = sec.get('question_count', 0)
            question_type = sec.get('question_type', 'mcq4')
            
            if question_type == 'mcq5':
                opts = 5
            elif question_type == 'mcq4':
                opts = 4
            elif question_type == 'true_false':
                opts = 2
            else:
                opts = 0
            
            section_height = (margin_bottom - margin_top) // max(len(sub.get('sections', [])), 1)
            questions_per_row = min(question_count, 20)
            cell_height = section_height // (int(np.ceil(question_count / questions_per_row)) + 1)
            cell_width = (margin_right - margin_left) // (opts + 1)
            
            for q in range(question_count):
                row = q // questions_per_row
                y = margin_top + row * cell_height + int(cell_height * 0.3)
                
                student_ans = answers.get(section_key, {}).get(str(q), "")
                
                for opt in range(opts):
                    x = margin_left + (opt + 1) * cell_width
                    bubble_r = int(cell_width * 0.3)
                    
                    if question_type == 'true_false':
                        letter = "T" if opt == 0 else "F"
                    else:
                        letter = chr(65 + opt)
                    
                    if student_ans.upper() == letter.upper():
                        # Yashil doira - tanlangan javob
                        cv2.circle(result, (x, y), bubble_r, (0, 255, 0), 2)
    
    return result


@omr_bp.route('/api/omr/process', methods=['POST'])
def process_omr():
    """OMR processing endpoint"""
    try:
        # Rasmni olish
        if 'image' not in request.files:
            return jsonify({"error": "Rasm topilmadi"}), 400
        
        image_file = request.files['image']
        subjects = eval(request.form.get('subjects', '[]'))
        
        # Rasmni o'qish
        image = Image.open(image_file.stream)
        image_np = np.array(image)
        
        # RGB ga o'tkazish
        if image_np.shape[2] == 4:
            image_np = cv2.cvtColor(image_np, cv2.COLOR_RGBA2RGB)
        
        # 1. Burchaklarni topish
        gray = cv2.cvtColor(image_np, cv2.COLOR_RGB2GRAY)
        corners = find_corners(gray)
        
        if len(corners) < 4:
            return jsonify({
                "error": "4 ta burchak markeri topilmadi. Varaqni to'g'ri joylashtiring.",
                "totalDetected": 0,
                "confidence": 0
            }), 400
        
        # 2. Perspektivani to'g'rilash
        warped = warp_perspective(image_np, corners)
        
        # 3. Javoblarni aniqlash
        result = detect_answers(warped, subjects)
        
        # 4. Vizual natija yaratish
        result_image = draw_result_overlay(warped, result['answers'], subjects)
        
        # 5. Preview image yaratish
        _, buffer = cv2.imencode('.jpg', cv2.cvtColor(result_image, cv2.COLOR_RGB2BGR))
        preview_base64 = base64.b64encode(buffer).decode('utf-8')
        
        return jsonify({
            "answers": result['answers'],
            "totalDetected": result['totalDetected'],
            "confidence": result['confidence'],
            "preview": f"data:image/jpeg;base64,{preview_base64}"
        })
        
    except Exception as e:
        print(f"OMR Error: {str(e)}")
        return jsonify({"error": str(e)}), 500
