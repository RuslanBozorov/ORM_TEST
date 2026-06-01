import { useState } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ScanLine, Keyboard, Loader2, CheckCircle2, Camera } from "lucide-react";
import { toast } from "sonner";
import AnswerInputGrid from "@/components/scan/AnswerInputGrid";
import OmrScanner from "@/components/scan/OmrScanner";
import { cn } from "@/lib/utils";

export default function Scan() {
  const queryClient = useQueryClient();
  const [selectedTestId, setSelectedTestId] = useState("");
  const [studentName, setStudentName] = useState("");
  const [className, setClassName] = useState("");
  const [rollNumber, setRollNumber] = useState("");
  const [studentAnswers, setStudentAnswers] = useState({});
  const [result, setResult] = useState(null);
  const [processing, setProcessing] = useState(false);
  const [inputMode, setInputMode] = useState("scan"); // "scan" | "manual"
  const [scanConfidence, setScanConfidence] = useState(null);

  const { data: tests = [] } = useQuery({
    queryKey: ["tests"],
    queryFn: () => base44.entities.Test.list("-created_date", 50),
  });

  const selectedTest = tests.find((t) => t.id === selectedTestId);

  const createResultMutation = useMutation({
    mutationFn: (data) => base44.entities.TestResult.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["results"] });
    },
  });

  // Called by OmrScanner when scan is done
  const handleScanned = ({ answers, student_name, roll_number, class_name, confidence }) => {
    setStudentAnswers(answers);
    if (student_name) setStudentName(student_name);
    if (roll_number) setRollNumber(roll_number);
    if (class_name && !className) setClassName(class_name);
    setScanConfidence(confidence);
    // Switch to manual mode to let user review/edit
    setInputMode("manual");
  };

  const processAnswers = () => {
    if (!selectedTest || !studentName) {
      toast.error("Test va o'quvchi ismini kiriting");
      return;
    }

    setProcessing(true);

    setTimeout(() => {
      let totalCorrect = 0;
      let totalWrong = 0;
      let totalUnanswered = 0;
      let totalScore = 0;
      let maxScore = 0;
      const subjectScores = [];
      const allAnswers = [];

      selectedTest.subjects?.forEach((sub, subIdx) => {
        let subCorrect = 0;
        let subWrong = 0;
        let subScore = 0;
        let subMax = 0;

        sub.sections?.forEach((sec, secIdx) => {
          const key = `${subIdx}-${secIdx}`;
          subMax += (sec.question_count || 0) * (sec.correct_score || 0);

          for (let q = 0; q < sec.question_count; q++) {
            const studentAns = studentAnswers[key]?.[q] || "";
            const correctAns = sec.answers?.[q] || "";
            allAnswers.push(studentAns);

            if (!studentAns) {
              totalUnanswered++;
            } else if (studentAns.toUpperCase() === correctAns.toUpperCase()) {
              totalCorrect++;
              subCorrect++;
              totalScore += sec.correct_score || 0;
              subScore += sec.correct_score || 0;
            } else {
              totalWrong++;
              subWrong++;
              totalScore += sec.wrong_score || 0;
              subScore += sec.wrong_score || 0;
            }
          }
        });

        maxScore += subMax;
        subjectScores.push({
          subject_name: sub.name,
          score: Math.max(0, subScore),
          max_score: subMax,
          correct: subCorrect,
          wrong: subWrong,
          percentage: subMax > 0 ? Math.round((Math.max(0, subScore) / subMax) * 100 * 10) / 10 : 0,
        });
      });

      totalScore = Math.max(0, totalScore);
      const percentage = maxScore > 0 ? Math.round((totalScore / maxScore) * 100 * 10) / 10 : 0;

      const resultData = {
        test_id: selectedTest.id,
        student_name: studentName,
        class_name: className || selectedTest.class_name,
        test_name: selectedTest.name,
        total_score: totalScore,
        max_score: maxScore,
        percentage,
        correct_count: totalCorrect,
        wrong_count: totalWrong,
        unanswered_count: totalUnanswered,
        subject_scores: subjectScores,
        answers: allAnswers,
        roll_number: rollNumber,
      };

      setResult(resultData);
      createResultMutation.mutate(resultData);
      toast.success("Natija saqlandi!");
      setProcessing(false);
    }, 400);
  };

  const resetForm = () => {
    setStudentName("");
    setClassName("");
    setRollNumber("");
    setStudentAnswers({});
    setResult(null);
    setScanConfidence(null);
    setInputMode("scan");
  };

  // Count filled answers
  const filledCount = Object.values(studentAnswers).reduce((total, secAnswers) => {
    return total + Object.values(secAnswers).filter((a) => a && a !== "").length;
  }, 0);

  const totalQuestions = selectedTest?.total_questions || 0;

  if (result) {
    return (
      <div className="max-w-2xl mx-auto px-4 md:px-8 py-6 md:py-8">
        <Card className="overflow-hidden">
          {/* Header */}
          <div className="bg-gradient-to-br from-primary to-primary/80 p-6 text-primary-foreground text-center">
            <CheckCircle2 className="w-12 h-12 mx-auto mb-3 opacity-90" />
            <h3 className="text-2xl font-bold">{result.student_name}</h3>
            <p className="text-sm opacity-80 mt-1">
              {result.test_name}
              {result.class_name && ` • ${result.class_name}`}
            </p>
          </div>

          <div className="p-6">
            {/* Score cards */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
              <div className="text-center p-4 bg-primary/5 rounded-xl border border-primary/10">
                <p className="text-3xl font-bold text-primary">{result.total_score}</p>
                <p className="text-xs text-muted-foreground mt-1">/ {result.max_score} ball</p>
              </div>
              <div className="text-center p-4 bg-green-50 rounded-xl border border-green-100">
                <p className="text-3xl font-bold text-green-600">{result.correct_count}</p>
                <p className="text-xs text-muted-foreground mt-1">To'g'ri ✓</p>
              </div>
              <div className="text-center p-4 bg-red-50 rounded-xl border border-red-100">
                <p className="text-3xl font-bold text-red-500">{result.wrong_count}</p>
                <p className="text-xs text-muted-foreground mt-1">Noto'g'ri ✗</p>
              </div>
              <div className="text-center p-4 bg-muted rounded-xl">
                <p className="text-3xl font-bold text-foreground">{result.percentage}%</p>
                <p className="text-xs text-muted-foreground mt-1">Foiz</p>
              </div>
            </div>

            {/* Subject breakdown */}
            <div className="space-y-2 mb-6">
              {result.subject_scores?.map((ss, i) => (
                <div key={i} className="flex items-center justify-between p-3 bg-muted/50 rounded-lg">
                  <span className="font-medium text-sm">{ss.subject_name}</span>
                  <div className="flex items-center gap-4 text-sm">
                    <span className="text-green-600 font-medium">{ss.correct} ✓</span>
                    <span className="text-red-500 font-medium">{ss.wrong} ✗</span>
                    <span className="font-bold">{ss.score}<span className="text-muted-foreground font-normal">/{ss.max_score}</span></span>
                    <span className={cn(
                      "text-xs font-semibold px-2 py-0.5 rounded-full",
                      ss.percentage >= 70 ? "bg-green-100 text-green-700" :
                      ss.percentage >= 50 ? "bg-yellow-100 text-yellow-700" :
                      "bg-red-100 text-red-700"
                    )}>
                      {ss.percentage}%
                    </span>
                  </div>
                </div>
              ))}
            </div>

            <Button onClick={resetForm} className="w-full h-11">
              Keyingi o'quvchi →
            </Button>
          </div>
        </Card>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto px-4 md:px-8 py-6 md:py-8">
      <div className="mb-6">
        <h2 className="text-2xl font-bold font-heading">Skanerlash</h2>
        <p className="text-muted-foreground text-sm mt-1">OMR varaqni AI bilan skanerlang yoki qo'lda kiriting</p>
      </div>

      <div className="space-y-5">
        {/* Step 1: Test & student info */}
        <Card className="p-5">
          <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide mb-4">1. Test va o'quvchi</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3">
            <div className="lg:col-span-2">
              <Label>Test *</Label>
              <Select value={selectedTestId} onValueChange={setSelectedTestId}>
                <SelectTrigger>
                  <SelectValue placeholder="Test tanlang" />
                </SelectTrigger>
                <SelectContent>
                  {tests.map((t) => (
                    <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>O'quvchi ismi *</Label>
              <Input
                value={studentName}
                onChange={(e) => setStudentName(e.target.value)}
                placeholder="Ism familiya"
              />
            </div>
            <div>
              <Label>Sinf</Label>
              <Input
                value={className}
                onChange={(e) => setClassName(e.target.value)}
                placeholder={selectedTest?.class_name || "Sinf"}
              />
            </div>
          </div>
        </Card>

        {/* Step 2: Input method */}
        {selectedTest && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">2. Javoblarni kiriting</h3>
              <Tabs value={inputMode} onValueChange={setInputMode}>
                <TabsList className="h-9">
                  <TabsTrigger value="scan" className="gap-1.5 text-xs px-3">
                    <Camera className="w-3.5 h-3.5" />
                    AI Skanerlash
                  </TabsTrigger>
                  <TabsTrigger value="manual" className="gap-1.5 text-xs px-3">
                    <Keyboard className="w-3.5 h-3.5" />
                    Qo'lda kiritish
                  </TabsTrigger>
                </TabsList>
              </Tabs>
            </div>

            {inputMode === "scan" && (
              <OmrScanner test={selectedTest} onScanned={handleScanned} />
            )}

            {/* Answer grid — always visible in manual mode, shown after scan too */}
            {inputMode === "manual" && (
              <>
                {scanConfidence && (
                  <div className={cn(
                    "flex items-center gap-2 text-sm px-4 py-2.5 rounded-lg border",
                    scanConfidence === "high" ? "bg-green-50 border-green-200 text-green-800" :
                    scanConfidence === "medium" ? "bg-yellow-50 border-yellow-200 text-yellow-800" :
                    "bg-orange-50 border-orange-200 text-orange-800"
                  )}>
                    <CheckCircle2 className="w-4 h-4 shrink-0" />
                    <span>
                      AI skanerlash natijalari ko'rsatilmoqda (ishonch: {
                        scanConfidence === "high" ? "yuqori" :
                        scanConfidence === "medium" ? "o'rtacha" : "past"
                      }). Xatolarni tekshirib, to'g'rilang.
                    </span>
                  </div>
                )}
                <AnswerInputGrid
                  test={selectedTest}
                  answers={studentAnswers}
                  setAnswers={setStudentAnswers}
                />
              </>
            )}

            {/* Progress & submit */}
            {inputMode === "manual" && (
              <Card className="p-4">
                <div className="flex items-center justify-between mb-3">
                  <span className="text-sm text-muted-foreground">
                    Kiritilgan javoblar: <strong className="text-foreground">{filledCount}</strong> / {totalQuestions}
                  </span>
                  <span className="text-sm font-medium text-primary">{totalQuestions > 0 ? Math.round((filledCount / totalQuestions) * 100) : 0}%</span>
                </div>
                <div className="h-2 bg-muted rounded-full overflow-hidden mb-4">
                  <div
                    className="h-full bg-primary rounded-full transition-all duration-300"
                    style={{ width: `${totalQuestions > 0 ? (filledCount / totalQuestions) * 100 : 0}%` }}
                  />
                </div>
                <Button
                  onClick={processAnswers}
                  disabled={processing || !studentName}
                  className="w-full h-12 text-base gap-2"
                >
                  {processing ? (
                    <><Loader2 className="w-5 h-5 animate-spin" /> Hisoblanmoqda...</>
                  ) : (
                    <><ScanLine className="w-5 h-5" /> Natijani Hisoblash</>
                  )}
                </Button>
              </Card>
            )}
          </div>
        )}
      </div>
    </div>
  );
}