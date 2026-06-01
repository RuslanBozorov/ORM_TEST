import { useRef, useState, useCallback, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Camera, Loader2, CheckCircle2, Scan, RotateCcw, Zap } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

/**
 * OMR Scanner with OpenCV.js (Client-side)
 * - Brauzerda OpenCV.js ishlatadi
 * - 4 ta burchak markerlarini real vaqtda topadi
 * - Burchaklar to'g'ri kelganda avtomatik skanerlaydi
 * - Barcha variantlarni (to'ldirilgan va bo'sh) tekshiradi
 */
export default function OmrScanner({ test, onScanned }) {
  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const streamRef = useRef(null);
  const scanIntervalRef = useRef(null);
  
  const [scanning, setScanning] = useState(false);
  const [hasCamera, setHasCamera] = useState(false);
  const [cvReady, setCvReady] = useState(!!window.cv);
  const [scanResult, setScanResult] = useState(null);
  const [scanProgress, setScanProgress] = useState("");
  const [previewImage, setPreviewImage] = useState(null);
  const [cornersDetected, setCornersDetected] = useState(false);
  const [autoScanMode, setAutoScanMode] = useState(true);
  const [cornerCount, setCornerCount] = useState(0);
  
  const cornerDetectCountRef = useRef(0);

  // OpenCV yuklanishini kuzatish
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

  // Kamerani yoqish
  const startCamera = async () => {
    try {
      setScanProgress("Kamera yuklanmoqda...");
      
      const constraints = {
        video: { 
          facingMode: "environment",
          width: { ideal: 1280, min: 640 }, 
          height: { ideal: 720, min: 480 } 
        },
        audio: false
      };
      
      const stream = await navigator.mediaDevices.getUserMedia(constraints);
      
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        streamRef.current = stream;
        
        videoRef.current.setAttribute("playsinline", "true");
        videoRef.current.setAttribute("autoplay", "true");
        videoRef.current.setAttribute("muted", "true");
        
        await videoRef.current.play();
        
        setHasCamera(true);
        setScanResult(null);
        setPreviewImage(null);
        setCornersDetected(false);
        cornerDetectCountRef.current = 0;
        setScanProgress("");
        
        if (autoScanMode && window.cv) {
          startRealTimeDetection();
        }
      }
    } catch (err) {
      console.error("Camera error:", err);
      setScanProgress("");
      
      if (err.name === "NotAllowedError") {
        toast.error("Kamera ruxsati rad etildi.");
      } else if (err.name === "NotFoundError") {
        toast.error("Kamera topilmadi.");
      } else {
        toast.error("Kamera ochilmadi: " + err.message);
      }
    }
  };

  // Real-time burchak aniqlash
  const startRealTimeDetection = () => {
    if (scanIntervalRef.current) return;
    
    scanIntervalRef.current = setInterval(() => {
      if (!videoRef.current || !window.cv || scanning) return;
      
      const video = videoRef.current;
      if (video.readyState < 2) return;
      
      const canvas = canvasRef.current;
      if (!canvas) return;
      
      canvas.width = 640;
      canvas.height = 480;
      
      const ctx = canvas.getContext("2d");
      ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
      
      const cv = window.cv;
      const src = cv.imread(canvas);
      const gray = new cv.Mat();
      cv.cvtColor(src, gray, cv.COLOR_RGBA2GRAY);
      
      const corners = findCornersQuick(gray, cv);
      setCornerCount(corners.length);
      
      if (corners.length >= 4) {
        cornerDetectCountRef.current++;
        setCornersDetected(true);
        
        if (cornerDetectCountRef.current >= 3) {
          stopRealTimeDetection();
          setScanning(true);
          captureAndProcess();
        }
      } else {
        cornerDetectCountRef.current = Math.max(0, cornerDetectCountRef.current - 1);
        setCornersDetected(false);
      }
      
      src.delete();
      gray.delete();
    }, 500);
  };

  const stopRealTimeDetection = () => {
    if (scanIntervalRef.current) {
      clearInterval(scanIntervalRef.current);
      scanIntervalRef.current = null;
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

  // Rasm olish va processing
  const captureAndProcess = useCallback(async () => {
    if (!videoRef.current || !test?.subjects) return;

    setScanProgress("Screenshot olinmoqda...");

    const video = videoRef.current;
    const canvas = canvasRef.current;
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    const ctx = canvas.getContext("2d");
    ctx.drawImage(video, 0, 0);

    setPreviewImage(canvas.toDataURL("image/jpeg", 0.9));
    setScanProgress("OpenCV yuklanmoqda...");

    let cv = window.cv;
    if (!cv) {
      for (let i = 0; i < 10; i++) {
        await new Promise((r) => setTimeout(r, 500));
        if (window.cv) {
          cv = window.cv;
          break;
        }
      }
      if (!cv) {
        toast.error("OpenCV yuklanmadi.");
        setScanning(false);
        return;
      }
    }

    try {
      setScanProgress("Rasm tahlil qilinmoqda...");

      const src = cv.imread(canvas);
      const gray = new cv.Mat();
      cv.cvtColor(src, gray, cv.COLOR_RGBA2GRAY, 0);

      setScanProgress("Burchak markerlari qidirilmoqda...");
      const corners = findCorners(gray, cv);

      if (corners.length < 4) {
        src.delete(); gray.delete();
        toast.error("4 ta burchak markeri topilmadi.");
        setScanning(false);
        setScanProgress("");
        return;
      }

      setScanProgress("Perspektiva to'g'rilanmoqda...");
      const warped = warpPerspective(src, corners, cv);

      setScanProgress("Barcha javoblar tekshirilmoqda...");
      const answers = detectAllAnswers(warped, test, cv);

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

  // Tezkor burchak topish (real-time)
  function findCornersQuick(grayMat, cv) {
    const blurred = new cv.Mat();
    cv.GaussianBlur(grayMat, blurred, new cv.Size(5, 5), 0);

    const thresh = new cv.Mat();
    cv.threshold(blurred, thresh, 40, 255, cv.THRESH_BINARY_INV);

    const contours = new cv.MatVector();
    const hierarchy = new cv.Mat();
    cv.findContours(thresh, contours, hierarchy, cv.RETR_EXTERNAL, cv.CHAIN_APPROX_SIMPLE);

    let candidates = [];
    for (let i = 0; i < contours.size(); i++) {
      const contour = contours.get(i);
      const area = cv.contourArea(contour);
      if (area > 200 && area < 30000) {
        const peri = cv.arcLength(contour, true);
        const approx = new cv.Mat();
        cv.approxPolyDP(contour, approx, 0.05 * peri, true);
        if (approx.rows === 4) {
          const pts = [];
          for (let j = 0; j < 4; j++) {
            pts.push({ 
              x: approx.data32S[j * 2],
              y: approx.data32S[j * 2 + 1] 
            });
          }
          candidates.push(pts);
        }
        approx.delete();
      }
    }

    contours.delete(); hierarchy.delete(); blurred.delete(); thresh.delete();

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

  // Aniq burchak topish (processing uchun)
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

  function sortCorners(pts) {
    const sorted = [...pts].sort((a, b) => a.y - b.y);
    const top = sorted.slice(0, 2).sort((a, b) => a.x - b.x);
    const bottom = sorted.slice(2).sort((a, b) => a.x - b.x);
    return [top[0], top[1], bottom[1], bottom[0]];
  }

  function warpPerspective(src, corners, cv) {
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

  // BARCHA javoblarni aniqlash (to'ldirilgan va bo'sh)
  function detectAllAnswers(warped, test, cv) {
    const gray = new cv.Mat();
    cv.cvtColor(warped, gray, cv.COLOR_RGBA2GRAY, 0);

    const thresh = new cv.Mat();
    cv.threshold(gray, thresh, 100, 255, cv.THRESH_BINARY_INV);

    const answers = { map: {}, allOptions: {}, totalDetected: 0, totalQuestions: 0, confidence: 0 };
    const width = warped.cols;
    const height = warped.rows;

    const marginTop = height * 0.1;
    const marginBottom = height * 0.95;
    const marginLeft = width * 0.05;
    const marginRight = width * 0.95;

    test.subjects.forEach((sub, subIdx) => {
      sub.sections?.forEach((sec, secIdx) => {
        const sectionKey = `${subIdx}-${secIdx}`;
        answers.map[sectionKey] = {};
        answers.allOptions[sectionKey] = [];
        
        const count = sec.question_count || 0;
        answers.totalQuestions += count;

        const isMcq = sec.question_type === "mcq4" || sec.question_type === "mcq5";
        const isTF = sec.question_type === "true_false";
        const opts = isMcq ? (sec.question_type === "mcq5" ? 5 : 4) : isTF ? 2 : 0;

        const sectionHeight = (marginBottom - marginTop) / Math.max(test.subjects.reduce((s, sub) => s + (sub.sections?.length || 1), 0), 1);
        const questionsPerRow = Math.min(count, 20);
        const cellWidth = (marginRight - marginLeft) / (opts + 1);
        const cellHeight = sectionHeight / (Math.ceil(count / questionsPerRow) + 1);

        for (let q = 0; q < count; q++) {
          const row = Math.floor(q / questionsPerRow);
          const y = marginTop + row * cellHeight + cellHeight * 0.3;
          
          let bestOption = { letter: "", confidence: 0 };
          const allOptionsForQuestion = [];

          for (let opt = 0; opt < opts; opt++) {
            const x = marginLeft + (opt + 1) * cellWidth;
            const bubbleR = cellWidth * 0.25;

            // Doira ichidagi piksellarni sanash
            let filledPixels = 0;
            let totalPixels = 0;

            for (let dy = -bubbleR; dy <= bubbleR; dy++) {
              for (let dx = -bubbleR; dx <= bubbleR; dx++) {
                if (dx * dx + dy * dy <= bubbleR * bubbleR) {
                  const px = Math.floor(x + dx);
                  const py = Math.floor(y + dy);
                  if (px >= 0 && px < width && py >= 0 && py < height) {
                    totalPixels++;
                    if (thresh.ucharPtr(py, px)[0] > 128) {
                      filledPixels++;
                    }
                  }
                }
              }
            }

            const fillRatio = totalPixels > 0 ? filledPixels / totalPixels : 0;
            const letter = isTF ? (opt === 0 ? "T" : "F") : String.fromCharCode(65 + opt);

            allOptionsForQuestion.push({
              option: letter,
              filled: fillRatio > 0.3,
              confidence: fillRatio
            });

            if (fillRatio > bestOption.confidence) {
              bestOption = { letter, confidence: fillRatio };
            }
          }

          answers.allOptions[sectionKey].push(allOptionsForQuestion);

          // Agar to'ldirilgan bo'lsa
          if (bestOption.confidence > 0.3) {
            answers.map[sectionKey][q] = bestOption.letter;
            answers.totalDetected++;
          } else {
            answers.map[sectionKey][q] = ""; // Bo'sh
          }
        }
      });
    });

    answers.confidence = answers.totalQuestions > 0 ? answers.totalDetected / answers.totalQuestions : 0;

    gray.delete(); thresh.delete();
    return answers;
  }

  // Loading state
  if (!cvReady) {
    return (
      <Card className="p-6 text-center">
        <Loader2 className="w-8 h-8 animate-spin mx-auto mb-3 text-muted-foreground" />
        <p className="text-sm text-muted-foreground">OpenCV.js yuklanmoqda...</p>
        <p className="text-xs text-muted-foreground mt-1">Birinchi marta 10-30 soniya kutishi mumkin</p>
      </Card>
    );
  }

  // Result state
  if (scanResult && previewImage) {
    return (
      <Card className="overflow-hidden">
        <div className="relative">
          <img src={previewImage} alt="Scan result" className="w-full" />
        </div>
        <div className="p-4 space-y-3">
          <div className="flex items-center gap-2 text-sm">
            <CheckCircle2 className="w-4 h-4 text-green-600" />
            <span>{scanResult.totalDetected} / {scanResult.totalQuestions} javob to'ldirilgan</span>
          </div>
          
          {/* Barcha variantlarni ko'rsatish */}
          {scanResult.allOptions && (
            <div className="space-y-2 max-h-48 overflow-y-auto">
              {Object.entries(scanResult.allOptions).map(([key, questions]) => (
                <div key={key} className="text-xs">
                  <p className="font-semibold mb-1">Section {key}:</p>
                  {questions.map((opts, qIdx) => (
                    <div key={qIdx} className="flex gap-1 mb-1">
                      <span className="font-medium w-6">{qIdx + 1}.</span>
                      {opts.map((opt) => (
                        <span
                          key={opt.option}
                          className={cn(
                            "px-2 py-0.5 rounded",
                            opt.filled ? "bg-green-100 text-green-800 font-bold" : "bg-gray-100 text-gray-400"
                          )}
                        >
                          {opt.option}
                        </span>
                      ))}
                    </div>
                  ))}
                </div>
              ))}
            </div>
          )}
          
          <Button onClick={resetScan} className="w-full gap-2">
            <RotateCcw className="w-4 h-4" /> Qayta skanerlash
          </Button>
        </div>
      </Card>
    );
  }

  // Active camera state
  return (
    <Card className="p-4">
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
        cornersDetected && "ring-4 ring-green-500"
      )}>
        {hasCamera ? (
          <>
            <video 
              ref={videoRef} 
              autoPlay 
              playsInline 
              muted 
              className="w-full h-full object-cover"
            />
            <canvas ref={canvasRef} className="hidden" />
            
            {autoScanMode && (
              <div className="absolute inset-0 pointer-events-none">
                {!cornersDetected && (
                  <div className="absolute inset-0 border-2 border-white/30 rounded-lg">
                    <div className="absolute top-0 left-0 w-8 h-8 border-t-4 border-l-4 border-blue-500 rounded-tl-lg" />
                    <div className="absolute top-0 right-0 w-8 h-8 border-t-4 border-r-4 border-blue-500 rounded-tr-lg" />
                    <div className="absolute bottom-0 left-0 w-8 h-8 border-b-4 border-l-4 border-blue-500 rounded-bl-lg" />
                    <div className="absolute bottom-0 right-0 w-8 h-8 border-b-4 border-r-4 border-blue-500 rounded-br-lg" />
                  </div>
                )}
                {cornersDetected && (
                  <div className="absolute inset-0 bg-green-500/20 flex items-center justify-center">
                    <div className="bg-green-600 text-white px-6 py-3 rounded-lg text-lg font-bold animate-pulse shadow-lg">
                      ✓ 4 ta burchak topildi! Skanerlanmoqda...
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
                Kamerani javob varag'iga qaratib turing
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

      {/* Burchak soni ko'rsatish */}
      {hasCamera && !scanning && (
        <div className="mb-3 text-center">
          <span className={cn(
            "inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-medium",
            cornerCount >= 4 ? "bg-green-100 text-green-800" : "bg-gray-100 text-gray-600"
          )}>
            <span className="w-2 h-2 rounded-full bg-current" />
            {cornerCount} / 4 burchak topildi
          </span>
        </div>
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
      
      <div className="mt-3 p-3 bg-blue-50 border border-blue-200 rounded-lg">
        <p className="text-xs text-blue-800">
          <strong> Maslahat:</strong> 4 ta qora burchak markerlari ko'rinadigan bo'lishi kerak. 
          Burchaklar to'g'ri kelganda avtomatik skanerlanadi.
        </p>
      </div>
    </Card>
  );
}
