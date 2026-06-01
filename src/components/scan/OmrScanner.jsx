import { useRef, useState, useCallback, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Camera, Loader2, CheckCircle2, Scan, RotateCcw, Zap } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

/**
 * OMR Scanner with OpenCV - Real-time mode
 * - Kamera orqali javob varag'ini real vaqtda skanerlaydi
 * - 4 ta qora burchak markerlarini avtomatik topadi
 * - Yashil ramka ko'rsatib, avtomatik screenshot oladi
 * - Perspektivani to'g'rilaydi
 * - Javob katakchalarini aniqlaydi
 */
export default function OmrScanner({ test, onScanned }) {
  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const overlayCanvasRef = useRef(null);
  const streamRef = useRef(null);
  const scanIntervalRef = useRef(null);
  const [scanning, setScanning] = useState(false);
  const [hasCamera, setHasCamera] = useState(false);
  const [cvReady, setCvReady] = useState(!!window.cv);
  const [scanResult, setScanResult] = useState(null);
  const [scanProgress, setScanProgress] = useState("");
  const [previewImage, setPreviewImage] = useState(null);
  const [cornersDetected, setCornersDetected] = useState(false);
  const [autoScanMode, setAutoScanMode] = useState(true); // Real-time auto-scan
  const [scanDelay, setScanDelay] = useState(3); // Seconds countdown
  const cornerDetectCountRef = useRef(0);

  useEffect(() => {
    if (window.cv && !cvReady) setCvReady(true);
    const checkCv = setInterval(() => {
      if (window.cv && !cvReady) {
        setCvReady(true);
        clearInterval(checkCv);
      }
    }, 500);
    return () => clearInterval(checkCv);
  }, [cvReady]);

  const startCamera = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: "environment", width: { ideal: 1280 }, height: { ideal: 720 } },
      });
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        streamRef.current = stream;
        setHasCamera(true);
        setScanResult(null);
        setPreviewImage(null);
        setCornersDetected(false);
        cornerDetectCountRef.current = 0;
        
        // Start real-time corner detection loop
        if (autoScanMode) {
          startRealTimeDetection();
        }
      }
    } catch {
      toast.error("Kamera ruxsati berilmadi");
    }
  };

  // Real-time corner detection loop
  const startRealTimeDetection = () => {
    if (scanIntervalRef.current) return;
    
    scanIntervalRef.current = setInterval(() => {
      if (!videoRef.current || !window.cv || scanning) return;
      
      const video = videoRef.current;
      if (video.readyState < 2) return; // Video not ready
      
      const canvas = canvasRef.current;
      if (!canvas) return;
      
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      const ctx = canvas.getContext("2d");
      ctx.drawImage(video, 0, 0);
      
      // Quick corner detection (low res for speed)
      const src = window.cv.imread(canvas);
      const gray = new window.cv.Mat();
      window.cv.cvtColor(src, gray, window.cv.COLOR_RGBA2GRAY);
      
      const corners = findCornersQuick(gray, window.cv);
      
      // Draw overlay
      drawCornersOverlay(canvas, corners);
      
      // Check if we have 4 corners
      if (corners.length >= 4) {
        cornerDetectCountRef.current++;
        setCornersDetected(true);
        
        // Auto-capture after 2 seconds of stable detection
        if (cornerDetectCountRef.current >= 10) { // ~2 seconds at 200ms interval
          stopRealTimeDetection();
          captureAndProcess();
        }
      } else {
        cornerDetectCountRef.current = Math.max(0, cornerDetectCountRef.current - 1);
        setCornersDetected(false);
      }
      
      src.delete();
      gray.delete();
    }, 200); // Check every 200ms
  };

  const stopRealTimeDetection = () => {
    if (scanIntervalRef.current) {
      clearInterval(scanIntervalRef.current);
      scanIntervalRef.current = null;
    }
  };

  // Draw corner detection overlay on canvas
  const drawCornersOverlay = (canvas, corners) => {
    const ctx = canvas.getContext("2d");
    const scaleX = canvas.width / videoRef.current.videoWidth;
    const scaleY = canvas.height / videoRef.current.videoHeight;
    
    // Draw corner markers
    corners.forEach((corner, idx) => {
      const x = corner[0].x * scaleX;
      const y = corner[0].y * scaleY;
      
      ctx.strokeStyle = cornersDetected ? "#00ff00" : "#ff0000";
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.arc(x, y, 15, 0, Math.PI * 2);
      ctx.stroke();
    });
    
    // If 4 corners found, draw connecting rectangle
    if (corners.length >= 4) {
      const sorted = sortCorners(corners);
      ctx.strokeStyle = "#00ff00";
      ctx.lineWidth = 4;
      ctx.setLineDash([10, 5]);
      ctx.beginPath();
      ctx.moveTo(sorted[0].x * scaleX, sorted[0].y * scaleY);
      ctx.lineTo(sorted[1].x * scaleX, sorted[1].y * scaleY);
      ctx.lineTo(sorted[2].x * scaleX, sorted[2].y * scaleY);
      ctx.lineTo(sorted[3].x * scaleX, sorted[3].y * scaleY);
      ctx.closePath();
      ctx.stroke();
      ctx.setLineDash([]);
      
      // Show "Capturing..." text
      ctx.fillStyle = "rgba(0, 255, 0, 0.8)";
      ctx.font = "bold 24px Arial";
      ctx.textAlign = "center";
      ctx.fillText("✓ Javob varag'i aniqlandi!", canvas.width / 2, 40);
    }
  };

  const stopCamera = () => {
    stopRealTimeDetection();
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    }
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
    setHasCamera(false);
    setCornersDetected(false);
  };

  // Screenshot olish va OpenCV bilan processing
  const captureAndProcess = useCallback(async () => {
    if (!videoRef.current || !test?.subjects) return;

    setScanning(true);
    setScanProgress("Screenshot olinmoqda...");

    // Screenshot
    const video = videoRef.current;
    const canvas = canvasRef.current;
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    const ctx = canvas.getContext("2d");
    ctx.drawImage(video, 0, 0);

    setPreviewImage(canvas.toDataURL("image/jpeg", 0.9));
    setScanProgress("OpenCV yuklanmoqda...");

    // OpenCV tayyor bo'lishini kutish
    let cv = window.cv;
    if (!cv) {
      // Agar hali yuklanmagan bo'lsa, 5 soniya kutamiz
      for (let i = 0; i < 10; i++) {
        await new Promise((r) => setTimeout(r, 500));
        if (window.cv) {
          cv = window.cv;
          break;
        }
      }
      if (!cv) {
        toast.error("OpenCV yuklanmadi. Internet tezligini tekshiring.");
        setScanning(false);
        return;
      }
    }

    try {
      setScanProgress("Rasm tahlil qilinmoqda...");

      // OpenCV processing
      const src = cv.imread(canvas);
      const gray = new cv.Mat();
      cv.cvtColor(src, gray, cv.COLOR_RGBA2GRAY, 0);

      // Burchak markerlarini topish
      setScanProgress("Burchak markerlari qidirilmoqda...");
      const corners = findCorners(gray, cv);

      if (corners.length < 4) {
        src.delete(); gray.delete();
        toast.error("4 ta burchak markeri topilmadi. Varaqni to'g'ri joylashtiring.");
        setScanning(false);
        setScanProgress("");
        return;
      }

      setScanProgress("Perspektiva to'g'rilanmoqda...");

      // Perspektivani to'g'rilash
      const warped = warpPerspective(src, corners, cv);

      // Javob katakchalarini aniqlash
      setScanProgress("Javoblar aniqlanmoqda...");
      const answers = detectAnswers(warped, test, cv);

      // Overlay chizish
      drawOverlay(warped, answers, test, cv);

      // Natijani ko'rsatish
      const resultCanvas = document.createElement("canvas");
      resultCanvas.width = warped.cols;
      resultCanvas.height = warped.rows;
      cv.imshow(resultCanvas, warped);
      setPreviewImage(resultCanvas.toDataURL("image/jpeg", 0.9));

      const confidence = answers.confidence > 0.8 ? "high" : answers.confidence > 0.5 ? "medium" : "low";

      onScanned({
        answers: answers.map,
        student_name: "",
        roll_number: "",
        class_name: "",
        confidence,
      });

      setScanResult(answers);
      setScanProgress("");
      toast.success(`Skanerlash tugadi! ${answers.totalDetected} javob aniqlandi.`);

      // Cleanup
      src.delete(); gray.delete(); warped.delete();

    } catch (err) {
      console.error("OpenCV error:", err);
      toast.error("Skanerlashda xatolik: " + err.message);
      setScanProgress("");
    }

    setScanning(false);
  }, [test, onScanned]);

  const resetScan = () => {
    setScanResult(null);
    setPreviewImage(null);
    setScanProgress("");
    if (!hasCamera) startCamera();
  };

  // === OpenCV algoritmlar ===

  // Tezkor burchak topish (real-time uchun optimallashtirilgan)
  function findCornersQuick(grayMat, cv) {
    const scale = 0.5; // Kichikroq o'lchamda ishlash tezroq
    const small = new cv.Mat();
    cv.resize(grayMat, small, new cv.Size(grayMat.cols * scale, grayMat.rows * scale));
    
    const blurred = new cv.Mat();
    cv.GaussianBlur(small, blurred, new cv.Size(5, 5), 0);

    // Qora ranglarni topish (markerlar qora)
    const thresh = new cv.Mat();
    cv.threshold(blurred, thresh, 40, 255, cv.THRESH_BINARY_INV);

    const contours = new cv.MatVector();
    const hierarchy = new cv.Mat();
    cv.findContours(thresh, contours, hierarchy, cv.RETR_EXTERNAL, cv.CHAIN_APPROX_SIMPLE);

    let candidates = [];
    for (let i = 0; i < contours.size(); i++) {
      const contour = contours.get(i);
      const area = cv.contourArea(contour);
      // Kichikroq maydon oralig'i (tezroq)
      if (area > 200 && area < 30000) {
        const peri = cv.arcLength(contour, true);
        const approx = new cv.Mat();
        cv.approxPolyDP(contour, approx, 0.05 * peri, true);
        if (approx.rows === 4) {
          const pts = [];
          for (let j = 0; j < 4; j++) {
            pts.push({ 
              x: approx.data32S[j * 2] / scale,  // Original o'lchamga qaytarish
              y: approx.data32S[j * 2 + 1] / scale 
            });
          }
          candidates.push(pts);
        }
        approx.delete();
      }
    }

    contours.delete(); hierarchy.delete(); blurred.delete(); thresh.delete(); small.delete();

    // Eng katta 4 ta to'rtburchakni tanlash
    if (candidates.length >= 4) {
      candidates.sort((a, b) => {
        const areaA = Math.abs((a[1].x - a[0].x) * (a[2].y - a[0].y) - (a[2].x - a[0].x) * (a[1].y - a[0].y));
        const areaB = Math.abs((b[1].x - b[0].x) * (b[2].y - b[0].y) - (b[2].x - b[0].x) * (b[1].y - b[0].y));
        return areaB - areaA;
      });
      return candidates.slice(0, 4);
    }

    return candidates;
  }

  function findCorners(grayMat, cv) {
    const blurred = new cv.Mat();
    cv.GaussianBlur(grayMat, blurred, new cv.Size(5, 5), 0);

    const edges = new cv.Mat();
    cv.Canny(blurred, edges, 50, 150);

    const contours = new cv.MatVector();
    const hierarchy = new cv.Mat();
    cv.findContours(edges, contours, hierarchy, cv.RETR_EXTERNAL, cv.CHAIN_APPROX_SIMPLE);

    let candidates = [];
    for (let i = 0; i < contours.size(); i++) {
      const contour = contours.get(i);
      const area = cv.contourArea(contour);
      if (area > 500 && area < 50000) {
        const peri = cv.arcLength(contour, true);
        const approx = new cv.Mat();
        cv.approxPolyDP(contour, approx, 0.03 * peri, true);
        if (approx.rows === 4) {
          const pts = [];
          for (let j = 0; j < 4; j++) {
            pts.push({ x: approx.data32S[j * 2], y: approx.data32S[j * 2 + 1] });
          }
          candidates.push(pts);
        }
        approx.delete();
      }
    }

    contours.delete(); hierarchy.delete(); blurred.delete(); edges.delete();

    // Eng katta 4 ta to'rtburchakni tanlash (burchak markerlari)
    if (candidates.length >= 4) {
      candidates.sort((a, b) => {
        const areaA = Math.abs((a[1].x - a[0].x) * (a[2].y - a[0].y) - (a[2].x - a[0].x) * (a[1].y - a[0].y));
        const areaB = Math.abs((b[1].x - b[0].x) * (b[2].y - b[0].y) - (b[2].x - b[0].x) * (b[1].y - b[0].y));
        return areaB - areaA;
      });
      return candidates.slice(0, 4);
    }

    return candidates;
  }

  function warpPerspective(src, corners, cv) {
    // 4 ta burchakni tartiblash: TL, TR, BR, BL
    const sorted = sortCorners(corners);
    const [tl, tr, br, bl] = sorted;

    const width = Math.max(
      Math.sqrt((br.x - bl.x) ** 2 + (br.y - bl.y) ** 2),
      Math.sqrt((tr.x - tl.x) ** 2 + (tr.y - tl.y) ** 2)
    );
    const height = Math.max(
      Math.sqrt((tr.x - br.x) ** 2 + (tr.y - br.y) ** 2),
      Math.sqrt((tl.x - bl.x) ** 2 + (tl.y - bl.y) ** 2)
    );

    const dstTri = new cv.Mat(4, 1, cv.CV_32FC2);
    dstTri.data32F[0] = 0; dstTri.data32F[1] = 0;
    dstTri.data32F[2] = width; dstTri.data32F[3] = 0;
    dstTri.data32F[4] = width; dstTri.data32F[5] = height;
    dstTri.data32F[6] = 0; dstTri.data32F[7] = height;

    const srcTri = new cv.Mat(4, 1, cv.CV_32FC2);
    srcTri.data32F[0] = tl.x; srcTri.data32F[1] = tl.y;
    srcTri.data32F[2] = tr.x; srcTri.data32F[3] = tr.y;
    srcTri.data32F[4] = br.x; srcTri.data32F[5] = br.y;
    srcTri.data32F[6] = bl.x; srcTri.data32F[7] = bl.y;

    const M = cv.getPerspectiveTransform(srcTri, dstTri);
    const warped = new cv.Mat();
    cv.warpPerspective(src, warped, M, new cv.Size(width, height));

    srcTri.delete(); dstTri.delete(); M.delete();
    return warped;
  }

  function sortCorners(pts) {
    // 4 ta nuqtani TL, TR, BR, BL tartibida sortlash
    const sorted = [...pts].sort((a, b) => a.y - b.y);
    const top = sorted.slice(0, 2).sort((a, b) => a.x - b.x);
    const bottom = sorted.slice(2).sort((a, b) => a.x - b.x);
    return [top[0], top[1], bottom[1], bottom[0]];
  }

  function detectAnswers(warped, test, cv) {
    const gray = new cv.Mat();
    cv.cvtColor(warped, gray, cv.COLOR_RGBA2GRAY, 0);

    const thresh = new cv.Mat();
    cv.threshold(gray, thresh, 100, 255, cv.THRESH_BINARY_INV);

    const answers = { map: {}, totalDetected: 0, confidence: 0 };
    const width = warped.cols;
    const height = warped.rows;

    // Javob varag'i layout parametrlari
    const marginTop = height * 0.1;
    const marginBottom = height * 0.95;
    const marginLeft = width * 0.05;
    const marginRight = width * 0.95;

    let questionIdx = 0;
    let totalPossible = 0;
    let detectedCount = 0;

    test.subjects.forEach((sub, subIdx) => {
      sub.sections?.forEach((sec, secIdx) => {
        const sectionKey = `${subIdx}-${secIdx}`;
        answers.map[sectionKey] = {};
        const count = sec.question_count || 0;
        totalPossible += count;

        const isMcq = sec.question_type === "mcq4" || sec.question_type === "mcq5";
        const isTF = sec.question_type === "true_false";
        const opts = isMcq ? (sec.question_type === "mcq5" ? 5 : 4) : isTF ? 2 : 0;

        // Har bir savol uchun katakchalar joylashuvini hisoblash
        const sectionHeight = (marginBottom - marginTop) / Math.max(test.subjects.reduce((s, sub) => s + (sub.sections?.length || 1), 0), 1);
        const questionsPerRow = Math.min(count, 20);
        const cellWidth = (marginRight - marginLeft) / (opts + 1);
        const cellHeight = sectionHeight / (Math.ceil(count / questionsPerRow) + 1);

        for (let q = 0; q < count; q++) {
          const row = Math.floor(q / questionsPerRow);
          const col = q % questionsPerRow;

          const y = marginTop + row * cellHeight + cellHeight * 0.3;
          const bestOption = { letter: "", confidence: 0 };

          for (let opt = 0; opt < opts; opt++) {
            const x = marginLeft + (opt + 1) * cellWidth;
            const bubbleX = x;
            const bubbleY = y;
            const bubbleR = cellWidth * 0.25;

            // Doira ichidagi piksellarni tekshirish
            let filledPixels = 0;
            let totalPixels = 0;

            for (let dy = -bubbleR; dy <= bubbleR; dy++) {
              for (let dx = -bubbleR; dx <= bubbleR; dx++) {
                if (dx * dx + dy * dy <= bubbleR * bubbleR) {
                  const px = Math.floor(bubbleX + dx);
                  const py = Math.floor(bubbleY + dy);
                  if (px >= 0 && px < width && py >= 0 && py < height) {
                    totalPixels++;
                    if (thresh.ucharAt(py * width + px) > 128) {
                      filledPixels++;
                    }
                  }
                }
              }
            }

            const fillRatio = totalPixels > 0 ? filledPixels / totalPixels : 0;
            const letter = isTF ? (opt === 0 ? "T" : "F") : String.fromCharCode(65 + opt);

            if (fillRatio > bestOption.confidence) {
              bestOption.letter = letter;
              bestOption.confidence = fillRatio;
            }
          }

          // Agar to'ldirilgan bo'lsa
          if (bestOption.confidence > 0.3) {
            answers.map[sectionKey][q] = bestOption.letter;
            detectedCount++;
          }
        }
      });
    });

    answers.totalDetected = detectedCount;
    answers.confidence = totalPossible > 0 ? detectedCount / totalPossible : 0;

    gray.delete(); thresh.delete();
    return answers;
  }

  function drawOverlay(warped, answers, test, cv) {
    const width = warped.cols;
    const height = warped.rows;
    const marginTop = height * 0.1;
    const marginBottom = height * 0.95;
    const marginLeft = width * 0.05;
    const marginRight = width * 0.95;

    let questionIdx = 0;

    test.subjects.forEach((sub, subIdx) => {
      sub.sections?.forEach((sec, secIdx) => {
        const sectionKey = `${subIdx}-${secIdx}`;
        const count = sec.question_count || 0;
        const isMcq = sec.question_type === "mcq4" || sec.question_type === "mcq5";
        const isTF = sec.question_type === "true_false";
        const opts = isMcq ? (sec.question_type === "mcq5" ? 5 : 4) : isTF ? 2 : 0;

        const sectionHeight = (marginBottom - marginTop) / Math.max(test.subjects.reduce((s, sub) => s + (sub.sections?.length || 1), 0), 1);
        const questionsPerRow = Math.min(count, 20);
        const cellWidth = (marginRight - marginLeft) / (opts + 1);
        const cellHeight = sectionHeight / (Math.ceil(count / questionsPerRow) + 1);

        for (let q = 0; q < count; q++) {
          const row = Math.floor(q / questionsPerRow);
          const col = q % questionsPerRow;
          const y = marginTop + row * cellHeight + cellHeight * 0.3;

          const studentAns = answers.map[sectionKey]?.[q] || "";
          const correctAns = sec.answers?.[q] || "";
          const isEmpty = !studentAns;
          const isCorrect = studentAns.toUpperCase() === correctAns.toUpperCase();

          // Rang: yashil (to'g'ri), qizil (noto'g'ri), sariq (bo'sh)
          let color;
          if (isEmpty) color = [255, 255, 0]; // Sariq
          else if (isCorrect) color = [0, 255, 0]; // Yashil
          else color = [255, 0, 0]; // Qizil

          for (let opt = 0; opt < opts; opt++) {
            const x = marginLeft + (opt + 1) * cellWidth;
            const letter = isTF ? (opt === 0 ? "T" : "F") : String.fromCharCode(65 + opt);
            const isSelected = studentAns.toUpperCase() === letter.toUpperCase();

            if (isSelected) {
              // Tanlangan javobni doira bilan belgilash
              const bubbleR = cellWidth * 0.3;
              for (let dy = -bubbleR; dy <= bubbleR; dy++) {
                for (let dx = -bubbleR; dx <= bubbleR; dx++) {
                  if (dx * dx + dy * dy <= bubbleR * bubbleR) {
                    const px = Math.floor(x + dx);
                    const py = Math.floor(y + dy);
                    if (px >= 0 && px < width && py >= 0 && py < height) {
                      warped.ucharPtr(py, px)[0] = color[2]; // B
                      warped.ucharPtr(py, px)[1] = color[1]; // G
                      warped.ucharPtr(py, px)[2] = color[0]; // R
                    }
                  }
                }
              }
            }
          }
        }
      });
    });
  }

  if (!cvReady) {
    return (
      <Card className="p-6 text-center">
        <Loader2 className="w-8 h-8 animate-spin mx-auto mb-3 text-muted-foreground" />
        <p className="text-sm text-muted-foreground">OpenCV yuklanmoqda...</p>
        <p className="text-xs text-muted-foreground mt-1">Birinchi marta 10-30 soniya kutishi mumkin</p>
      </Card>
    );
  }

  if (scanResult && previewImage) {
    return (
      <Card className="overflow-hidden">
        <div className="relative">
          <img src={previewImage} alt="Scan result" className="w-full" />
        </div>
        <div className="p-4 space-y-3">
          <div className="flex items-center gap-2 text-sm">
            <CheckCircle2 className="w-4 h-4 text-green-600" />
            <span>{scanResult.totalDetected} javob aniqlandi</span>
          </div>
          <div className="flex gap-2">
            <Button onClick={resetScan} variant="outline" className="flex-1 gap-2">
              <RotateCcw className="w-4 h-4" /> Qayta skanerlash
            </Button>
          </div>
        </div>
      </Card>
    );
  }

  return (
    <Card className="p-4">
      {/* Mode toggle */}
      <div className="flex items-center justify-between mb-3">
        <span className="text-xs text-muted-foreground">Skanerlash rejimi</span>
        <div className="flex gap-2">
          <Button 
            size="sm" 
            variant={autoScanMode ? "default" : "outline"}
            onClick={() => setAutoScanMode(true)}
            className="gap-1 h-7 text-xs"
          >
            <Zap className="w-3 h-3" /> Avtomatik
          </Button>
          <Button 
            size="sm" 
            variant={!autoScanMode ? "default" : "outline"}
            onClick={() => setAutoScanMode(false)}
            className="gap-1 h-7 text-xs"
          >
            <Scan className="w-3 h-3" /> Qo'lda
          </Button>
        </div>
      </div>
      
      <div className={cn(
        "aspect-video bg-muted rounded-lg overflow-hidden relative mb-4",
        cornersDetected && "ring-2 ring-green-500"
      )}>
        {hasCamera ? (
          <>
            <video ref={videoRef} autoPlay playsInline muted className="w-full h-full object-cover" />
            <canvas ref={canvasRef} className="hidden" />
            {/* Corner detection overlay */}
            {autoScanMode && (
              <div className="absolute inset-0 pointer-events-none">
                {/* Scanning animation */}
                {!cornersDetected && (
                  <div className="absolute inset-0 border-2 border-white/30 rounded-lg">
                    <div className="absolute top-0 left-0 w-8 h-8 border-t-4 border-l-4 border-blue-500 rounded-tl-lg" />
                    <div className="absolute top-0 right-0 w-8 h-8 border-t-4 border-r-4 border-blue-500 rounded-tr-lg" />
                    <div className="absolute bottom-0 left-0 w-8 h-8 border-b-4 border-l-4 border-blue-500 rounded-bl-lg" />
                    <div className="absolute bottom-0 right-0 w-8 h-8 border-b-4 border-r-4 border-blue-500 rounded-br-lg" />
                  </div>
                )}
                {/* Detected overlay */}
                {cornersDetected && (
                  <div className="absolute inset-0 bg-green-500/10 flex items-center justify-center">
                    <div className="bg-green-500 text-white px-4 py-2 rounded-full text-sm font-medium animate-pulse">
                      ✓ Javob varag'i topildi! Skanerlanmoqda...
                    </div>
                  </div>
                )}
              </div>
            )}
          </>
        ) : (
          <div className="flex flex-col items-center justify-center h-full text-muted-foreground">
            <Camera className="w-12 h-12 mb-3 opacity-30" />
            <p className="text-sm">Kamerani yoqing</p>
            {autoScanMode && (
              <p className="text-xs mt-2 text-center px-8">
                Kamerani javob varag'iga qaratib turing, avtomatik skanerlanadi
              </p>
            )}
          </div>
        )}
        {scanning && (
          <div className="absolute inset-0 bg-black/60 flex items-center justify-center">
            <div className="text-center text-white">
              <Loader2 className="w-8 h-8 animate-spin mx-auto mb-2" />
              <p className="text-sm font-medium">{scanProgress || "Skanerlanmoqda..."}</p>
            </div>
          </div>
        )}
        {previewImage && !scanning && (
          <img src={previewImage} alt="Preview" className="absolute inset-0 w-full h-full object-cover" />
        )}
      </div>

      {scanProgress && (
        <div className="mb-3 text-xs text-center text-muted-foreground">{scanProgress}</div>
      )}

      <div className="flex gap-2">
        {!hasCamera && !previewImage && (
          <Button onClick={startCamera} className="flex-1 gap-2">
            <Camera className="w-4 h-4" /> Kamerani yoqish
          </Button>
        )}
        {hasCamera && !autoScanMode && (
          <>
            <Button onClick={stopCamera} variant="outline" className="flex-1">
              O'chirish
            </Button>
            <Button onClick={captureAndProcess} disabled={scanning} className="flex-1 gap-2">
              {scanning ? (
                <><Loader2 className="w-4 h-4 animate-spin" /> Jarayonda...</>
              ) : (
                <><Scan className="w-4 h-4" /> Skanerlash</>
              )}
            </Button>
          </>
        )}
        {hasCamera && autoScanMode && (
          <Button onClick={stopCamera} variant="outline" className="flex-1 gap-2">
            <Camera className="w-4 h-4" /> Kamerani o'chirish
          </Button>
        )}
        {previewImage && !scanning && (
          <Button onClick={resetScan} className="w-full gap-2">
            <RotateCcw className="w-4 h-4" /> Qayta skanerlash
          </Button>
        )}
      </div>
      
      {/* Instructions */}
      {hasCamera && autoScanMode && !scanning && !previewImage && (
        <div className="mt-3 p-3 bg-blue-50 border border-blue-200 rounded-lg">
          <p className="text-xs text-blue-800">
            <strong> Maslahat:</strong> Javob varag'ini to'g'ri yoritilgan joyda ushlab turing. 
            4 ta qora burchak markerlari ko'rinadigan bo'lishi kerak.
          </p>
        </div>
      )}
    </Card>
  );
}
