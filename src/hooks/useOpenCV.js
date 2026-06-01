
import { useState, useEffect, useRef } from "react";

/**
 * Loads OpenCV.js from CDN and provides image preprocessing utilities.
 * Preprocessing pipeline:
 *   1. Grayscale conversion
 *   2. Gaussian blur (denoise)
 *   3. Adaptive threshold (binarize bubbles)
 *   4. Returns processed image as a File object
 */
export function useOpenCV() {
  const [cvReady, setCvReady] = useState(false);
  const [cvLoading, setCvLoading] = useState(false);
  const [cvError, setCvError] = useState(null);
  const loadedRef = useRef(false);

  useEffect(() => {
    if (loadedRef.current || window.cv) {
      setCvReady(true);
      return;
    }

    if (document.getElementById("opencv-js")) {
      // Script tag already added, wait for it
      const check = setInterval(() => {
        if (window.cv && window.cv.getBuildInformation) {
          setCvReady(true);
          loadedRef.current = true;
          clearInterval(check);
        }
      }, 200);
      return () => clearInterval(check);
    }

    setCvLoading(true);
    const script = document.createElement("script");
    script.id = "opencv-js";
    script.src = "https://docs.opencv.org/4.8.0/opencv.js";
    script.async = true;

    script.onload = () => {
      // OpenCV.js calls Module.onRuntimeInitialized when ready
      const waitForCv = setInterval(() => {
        if (window.cv && window.cv.getBuildInformation) {
          setCvReady(true);
          setCvLoading(false);
          loadedRef.current = true;
          clearInterval(waitForCv);
        }
      }, 200);
    };

    script.onerror = () => {
      setCvError("OpenCV.js yuklanmadi");
      setCvLoading(false);
    };

    document.head.appendChild(script);
  }, []);

  /**
   * Preprocess an image File for OMR detection:
   * - Grayscale
   * - Gaussian blur
   * - Adaptive threshold (improves bubble contrast)
   * Returns a new File (PNG) with the processed image.
   */
  const preprocessImage = async (file) => {
    if (!window.cv) throw new Error("OpenCV tayyor emas");

    return new Promise((resolve, reject) => {
      const img = new Image();
      const url = URL.createObjectURL(file);
      img.onload = () => {
        try {
          const cv = window.cv;

          // Draw original to canvas
          const canvas = document.createElement("canvas");
          canvas.width = img.width;
          canvas.height = img.height;
          const ctx = canvas.getContext("2d");
          ctx.drawImage(img, 0, 0);

          // Read into OpenCV Mat
          const src = cv.imread(canvas);

          // 1. Grayscale
          const gray = new cv.Mat();
          cv.cvtColor(src, gray, cv.COLOR_RGBA2GRAY);

          // 2. Gaussian blur to reduce noise
          const blurred = new cv.Mat();
          const ksize = new cv.Size(3, 3);
          cv.GaussianBlur(gray, blurred, ksize, 0);

          // 3. Adaptive threshold — makes bubbles clearly black/white
          const thresh = new cv.Mat();
          cv.adaptiveThreshold(
            blurred,
            thresh,
            255,
            cv.ADAPTIVE_THRESH_GAUSSIAN_C,
            cv.THRESH_BINARY,
            15,
            5
          );

          // 4. Convert back to RGBA for canvas display
          const result = new cv.Mat();
          cv.cvtColor(thresh, result, cv.COLOR_GRAY2RGBA);

          // Write to canvas
          const outCanvas = document.createElement("canvas");
          outCanvas.width = img.width;
          outCanvas.height = img.height;
          cv.imshow(outCanvas, result);

          // Cleanup
          src.delete();
          gray.delete();
          blurred.delete();
          thresh.delete();
          result.delete();
          URL.revokeObjectURL(url);

          // Convert canvas to File
          outCanvas.toBlob((blob) => {
            if (!blob) {
              reject(new Error("Canvas blob yaratilmadi"));
              return;
            }
            const processedFile = new File([blob], "omr_processed.png", { type: "image/png" });
            resolve({ file: processedFile, previewUrl: outCanvas.toDataURL("image/png") });
          }, "image/png", 0.95);
        } catch (err) {
          URL.revokeObjectURL(url);
          reject(err);
        }
      };
      img.onerror = () => {
        URL.revokeObjectURL(url);
        reject(new Error("Rasm yuklanmadi"));
      };
      img.src = url;
    });
  };

  return { cvReady, cvLoading, cvError, preprocessImage };
}