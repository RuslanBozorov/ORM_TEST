import { useRef, useState, useCallback, useEffect } from "react";
import Webcam from "react-webcam";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Camera, Loader2, CheckCircle2, Scan, RotateCcw, Zap } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

/**
 * OMR Scanner with Backend Processing
 * - react-webcam orqali kamera ochadi
 * - Rasmni backendga yuboradi
 * - Backend OpenCV bilan processing qiladi
 * - Natijani qaytaradi
 */
export default function OmrScanner({ test, onScanned }) {
  const webcamRef = useRef(null);
  const [hasCamera, setHasCamera] = useState(false);
  const [scanning, setScanning] = useState(false);
  const [scanProgress, setScanProgress] = useState("");
  const [previewImage, setPreviewImage] = useState(null);
  const [scanResult, setScanResult] = useState(null);
  const [autoScanMode, setAutoScanMode] = useState(true);
  const captureIntervalRef = useRef(null);

  // Webcam constraints
  const videoConstraints = {
    width: { ideal: 1280 },
    height: { ideal: 720 },
    facingMode: "environment" // Orqa kamera
  };

  // Kamerani to'xtatish
  const stopCapture = () => {
    if (captureIntervalRef.current) {
      clearInterval(captureIntervalRef.current);
      captureIntervalRef.current = null;
    }
  };

  // Kamerani yoqish
  const startCamera = () => {
    setHasCamera(true);
    setScanResult(null);
    setPreviewImage(null);
    
    if (autoScanMode) {
      startAutoCapture();
    }
  };

  // Kamerani o'chirish
  const stopCamera = () => {
    stopCapture();
    if (webcamRef.current) {
      webcamRef.current.video.srcObject?.getTracks().forEach(track => track.stop());
    }
    setHasCamera(false);
  };

  // Avtomatik rasm olish (har 2 soniyada)
  const startAutoCapture = () => {
    stopCapture();
    
    captureIntervalRef.current = setInterval(() => {
      captureAndSend();
    }, 2000);
  };

  // Rasm olish va backendga yuborish
  const captureAndSend = useCallback(async () => {
    if (!webcamRef.current || !test?.subjects) return;

    setScanning(true);
    setScanProgress("Rasm olinmoqda...");

    // Rasm olish
    const imageSrc = webcamRef.current.getScreenshot();
    if (!imageSrc) {
      setScanning(false);
      setScanProgress("");
      return;
    }

    setPreviewImage(imageSrc);
    setScanProgress("Serverga yuborilmoqda...");

    try {
      // Base64 dan Blob ga o'tkazish
      const response = await fetch(imageSrc);
      const blob = await response.blob();
      
      // FormData yaratish
      const formData = new FormData();
      formData.append("image", blob, "omr_capture.jpg");
      formData.append("test_id", test.id);
      formData.append("subjects", JSON.stringify(test.subjects));

      // Backendga yuborish (Flask server)
      const result = await fetch("http://localhost:5000/api/omr/process", {
        method: "POST",
        body: formData,
      });

      if (!result.ok) {
        throw new Error("Server xatosi");
      }

      const data = await result.json();
      
      if (data.error) {
        throw new Error(data.error);
      }

      // Natijani ko'rsatish
      setScanResult(data);
      setPreviewImage(data.preview || imageSrc);
      
      const confidence = data.confidence > 0.8 ? "high" : data.confidence > 0.5 ? "medium" : "low";
      
      onScanned({
        answers: data.answers,
        student_name: data.student_name || "",
        roll_number: data.roll_number || "",
        class_name: data.class_name || "",
        confidence,
      });

      setScanProgress("");
      toast.success(`Skanerlash tugadi! ${data.totalDetected} javob aniqlandi.`);
      
      // Avtomatik rejimni to'xtatish
      stopCapture();

    } catch (err) {
      console.error("OMR processing error:", err);
      toast.error("Skanerlashda xatolik: " + err.message);
      setScanProgress("");
    }

    setScanning(false);
  }, [test, onScanned]);

  // Qayta skanerlash
  const resetScan = () => {
    setScanResult(null);
    setPreviewImage(null);
    setScanProgress("");
    if (autoScanMode) {
      startAutoCapture();
    }
  };

  // Manual capture
  const manualCapture = () => {
    stopCapture();
    captureAndSend();
  };

  // Loading state
  if (!hasCamera) {
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
        
        <div className="aspect-video bg-muted rounded-lg overflow-hidden relative mb-4 flex flex-col items-center justify-center text-muted-foreground">
          <Camera className="w-12 h-12 mb-3 opacity-30" />
          <p className="text-sm">Kamerani yoqing</p>
          {autoScanMode && (
            <p className="text-xs mt-2 text-center px-8">
              Kamerani javob varag'iga qaratib turing, avtomatik skanerlanadi
            </p>
          )}
        </div>

        <Button onClick={startCamera} className="w-full gap-2">
          <Camera className="w-4 h-4" /> Kamerani yoqish
        </Button>
        
        <div className="mt-3 p-3 bg-blue-50 border border-blue-200 rounded-lg">
          <p className="text-xs text-blue-800">
            <strong> Maslahat:</strong> Javob varag'ini to'g'ri yoritilgan joyda ushlab turing. 
            4 ta qora burchak markerlari ko'rinadigan bo'lishi kerak.
          </p>
        </div>
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

  // Active camera state
  return (
    <Card className="p-4">
      <div className="flex items-center justify-between mb-3">
        <span className="text-xs text-muted-foreground">Skanerlash rejimi</span>
        <div className="flex gap-2">
          <Button 
            size="sm" 
            variant={autoScanMode ? "default" : "outline"}
            onClick={() => {
              setAutoScanMode(true);
              startAutoCapture();
            }}
            className="gap-1 h-7 text-xs"
          >
            <Zap className="w-3 h-3" /> Avtomatik
          </Button>
          <Button 
            size="sm" 
            variant={!autoScanMode ? "default" : "outline"}
            onClick={() => {
              setAutoScanMode(false);
              stopCapture();
            }}
            className="gap-1 h-7 text-xs"
          >
            <Scan className="w-3 h-3" /> Qo'lda
          </Button>
        </div>
      </div>
      
      <div className={cn(
        "aspect-video bg-muted rounded-lg overflow-hidden relative mb-4",
        scanning && "ring-2 ring-blue-500"
      )}>
        <Webcam
          ref={webcamRef}
          audio={false}
          screenshotFormat="image/jpeg"
          videoConstraints={videoConstraints}
          className="w-full h-full object-cover"
          onUserMedia={() => {
            if (autoScanMode) {
              startAutoCapture();
            }
          }}
          onUserMediaError={() => {
            toast.error("Kamera xatosi");
            setHasCamera(false);
          }}
        />
        
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

      {autoScanMode && (
        <Button onClick={stopCamera} variant="outline" className="w-full gap-2">
          <Camera className="w-4 h-4" /> Kamerani o'chirish
        </Button>
      )}

      {!autoScanMode && (
        <div className="flex gap-2">
          <Button onClick={stopCamera} variant="outline" className="flex-1">
            O'chirish
          </Button>
          <Button onClick={manualCapture} disabled={scanning} className="flex-1 gap-2">
            {scanning ? (
              <><Loader2 className="w-4 h-4 animate-spin" /> Jarayonda...</>
            ) : (
              <><Scan className="w-4 h-4" /> Skanerlash</>
            )}
          </Button>
        </div>
      )}
      
      {previewImage && !scanning && (
        <Button onClick={resetScan} className="w-full gap-2 mt-2">
          <RotateCcw className="w-4 h-4" /> Qayta skanerlash
        </Button>
      )}

      <div className="mt-3 p-3 bg-blue-50 border border-blue-200 rounded-lg">
        <p className="text-xs text-blue-800">
          <strong>💡 Maslahat:</strong> Javob varag'ini to'g'ri yoritilgan joyda ushlab turing. 
          4 ta qora burchak markerlari ko'rinadigan bo'lishi kerak.
        </p>
      </div>
    </Card>
  );
}
