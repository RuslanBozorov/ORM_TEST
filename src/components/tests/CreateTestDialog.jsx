import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { base44 } from "@/api/base44Client";
import { useQueryClient } from "@tanstack/react-query";
import toast from "react-hot-toast";
import { Plus, Trash2, ChevronRight, ChevronLeft } from "lucide-react";

const ANSWER_OPTIONS = ["A", "B", "C", "D", "E", "T", "F"];

export default function CreateTestDialog({ open, onOpenChange }) {
  const queryClient = useQueryClient();
  const [loading, setLoading] = useState(false);
  const [step, setStep] = useState(1);
  const [info, setInfo] = useState({
    name: "",
    class_name: "",
    date: new Date().toISOString().split("T")[0],
    description: "",
    status: "draft",
  });
  const [subjects, setSubjects] = useState([
    {
      name: "",
      sections: [
        {
          name: "Asosiy",
          question_type: "mcq4",
          question_count: 10,
          correct_score: 1,
          wrong_score: 0,
          answers: Array(10).fill(""),
        },
      ],
    },
  ]);

  const totalQuestions = subjects.reduce(
    (sum, s) => sum + s.sections.reduce((s2, sec) => s2 + (sec.question_count || 0), 0),
    0
  );
  const maxScore = subjects.reduce(
    (sum, s) =>
      sum +
      s.sections.reduce(
        (s2, sec) => s2 + (sec.question_count || 0) * (sec.correct_score || 0),
        0
      ),
    0
  );

  const updateSubject = (idx, field, value) => {
    const next = [...subjects];
    next[idx] = { ...next[idx], [field]: value };
    setSubjects(next);
  };

  const updateSection = (sIdx, secIdx, field, value) => {
    const next = [...subjects];
    const sec = next[sIdx].sections[secIdx];
    next[sIdx].sections[secIdx] = { ...sec, [field]: value };
    if (field === "question_count") {
      const count = parseInt(value) || 0;
      next[sIdx].sections[secIdx].answers = Array(count).fill("");
    }
    setSubjects(next);
  };

  const updateAnswer = (sIdx, secIdx, answerIdx, val) => {
    const next = [...subjects];
    const answers = [...next[sIdx].sections[secIdx].answers];
    answers[answerIdx] = val;
    next[sIdx].sections[secIdx].answers = answers;
    setSubjects(next);
  };

  const addSubject = () => {
    setSubjects([
      ...subjects,
      {
        name: "",
        sections: [
          {
            name: "Asosiy",
            question_type: "mcq4",
            question_count: 10,
            correct_score: 1,
            wrong_score: 0,
            answers: Array(10).fill(""),
          },
        ],
      },
    ]);
  };

  const removeSubject = (idx) => {
    if (subjects.length === 1) return;
    setSubjects(subjects.filter((_, i) => i !== idx));
  };

  const addSection = (sIdx) => {
    const next = [...subjects];
    next[sIdx].sections.push({
      name: `Bo'lim ${next[sIdx].sections.length + 1}`,
      question_type: "mcq4",
      question_count: 10,
      correct_score: 1,
      wrong_score: 0,
      answers: Array(10).fill(""),
    });
    setSubjects(next);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!info.name.trim()) {
      toast.error("Test nomini kiriting");
      return;
    }
    if (!subjects[0]?.name.trim()) {
      toast.error("Kamida bitta fan nomini kiriting");
      return;
    }
    setLoading(true);
    try {
      await base44.entities.Test.create({
        ...info,
        total_questions: totalQuestions,
        max_score: maxScore,
        subjects,
      });
      toast.success("Test yaratildi!");
      queryClient.invalidateQueries({ queryKey: ["tests"] });
      setStep(1);
      setInfo({
        name: "",
        class_name: "",
        date: new Date().toISOString().split("T")[0],
        description: "",
        status: "draft",
      });
      setSubjects([
        {
          name: "",
          sections: [
            {
              name: "Asosiy",
              question_type: "mcq4",
              question_count: 10,
              correct_score: 1,
              wrong_score: 0,
              answers: Array(10).fill(""),
            },
          ],
        },
      ]);
      onOpenChange(false);
    } catch (err) {
      toast.error("Xatolik: " + err.message);
    } finally {
      setLoading(false);
    }
  };

  // Step 1: Test info
  if (step === 1) {
    return (
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="sm:max-w-lg">
          <form onSubmit={(e) => { e.preventDefault(); if (!info.name.trim()) { toast.error("Test nomini kiriting"); return; } setStep(2); }}>
          <DialogHeader>
            <DialogTitle className="text-xl">Yangi test yaratish</DialogTitle>
            <DialogDescription>Test haqida asosiy ma'lumotlar</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 pt-4">
            <div className="space-y-2">
              <Label>Test nomi *</Label>
              <Input
                placeholder="Masalan: Matematika — 1-chi chorak"
                value={info.name}
                onChange={(e) => setInfo({ ...info, name: e.target.value })}
                autoFocus
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Sinf</Label>
                <Input
                  placeholder="9-A"
                  value={info.class_name}
                  onChange={(e) => setInfo({ ...info, class_name: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label>Sana</Label>
                <Input
                  type="date"
                  value={info.date}
                  onChange={(e) => setInfo({ ...info, date: e.target.value })}
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label>Holat</Label>
              <Select value={info.status} onValueChange={(v) => setInfo({ ...info, status: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="draft">Qoralama</SelectItem>
                  <SelectItem value="active">Faol</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Izoh</Label>
              <Textarea
                placeholder="Qo'shimcha ma'lumot..."
                rows={2}
                value={info.description}
                onChange={(e) => setInfo({ ...info, description: e.target.value })}
              />
            </div>
          </div>
          <DialogFooter className="gap-2 sm:gap-0">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Bekor qilish</Button>
            <Button
              type="button"
              onClick={() => {
                if (!info.name.trim()) { toast.error("Test nomini kiriting"); return; }
                setStep(2);
              }}
            >
              Keyingi <ChevronRight className="w-4 h-4 ml-1" />
            </Button>
          </DialogFooter>
        </form>
        </DialogContent>
      </Dialog>
    );
  }

  // Step 2: Subjects & answers
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl max-h-[85vh] flex flex-col">
        <form onSubmit={handleSubmit} className="flex flex-col flex-1 min-h-0">
        <DialogHeader>
          <DialogTitle className="text-xl">Fanlar va javob kaliti</DialogTitle>
          <DialogDescription>
            {info.name} • {totalQuestions} savol • {maxScore} ball
          </DialogDescription>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto space-y-4 pt-4 pr-1">
          {subjects.map((subject, sIdx) => (
            <div key={sIdx} className="border rounded-lg p-4 space-y-3">
              <div className="flex items-center justify-between">
                <Input
                  placeholder="Fan nomi *"
                  className="font-semibold text-base max-w-xs"
                  value={subject.name}
                  onChange={(e) => updateSubject(sIdx, "name", e.target.value)}
                />
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => removeSubject(sIdx)}
                  disabled={subjects.length === 1}
                  className="text-muted-foreground"
                >
                  <Trash2 className="w-4 h-4" />
                </Button>
              </div>

              {subject.sections.map((sec, secIdx) => (
                <div key={secIdx} className="bg-muted/40 rounded-lg p-3 space-y-3">
                  <div className="flex items-center justify-between">
                    <Input
                      placeholder="Bo'lim nomi"
                      className="max-w-[200px] text-sm"
                      value={sec.name}
                      onChange={(e) => updateSection(sIdx, secIdx, "name", e.target.value)}
                    />
                    <div className="flex gap-2 text-sm">
                      <Select
                        value={sec.question_type}
                        onValueChange={(v) => updateSection(sIdx, secIdx, "question_type", v)}
                      >
                        <SelectTrigger className="w-[110px] h-8"><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="mcq4">MCQ (A-D)</SelectItem>
                          <SelectItem value="mcq5">MCQ (A-E)</SelectItem>
                          <SelectItem value="true_false">T/F</SelectItem>
                          <SelectItem value="numerical">Raqamli</SelectItem>
                        </SelectContent>
                      </Select>
                      <Input
                        type="number"
                        min="1"
                        max="200"
                        className="w-16 h-8"
                        value={sec.question_count}
                        onChange={(e) => updateSection(sIdx, secIdx, "question_count", e.target.value)}
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-2 text-sm">
                    <div className="flex items-center gap-2">
                      <Label className="text-xs">To'g'ri</Label>
                      <Input
                        type="number"
                        className="w-16 h-8"
                        value={sec.correct_score}
                        onChange={(e) => updateSection(sIdx, secIdx, "correct_score", parseInt(e.target.value) || 0)}
                      />
                    </div>
                    <div className="flex items-center gap-2">
                      <Label className="text-xs">Noto'g'ri</Label>
                      <Input
                        type="number"
                        className="w-16 h-8"
                        value={sec.wrong_score}
                        onChange={(e) => updateSection(sIdx, secIdx, "wrong_score", parseInt(e.target.value) || 0)}
                      />
                    </div>
                  </div>

                  <div>
                    <Label className="text-xs mb-1 block">Javob kaliti</Label>
                    <div className="flex flex-wrap gap-1.5">
                      {sec.answers.map((ans, aIdx) => {
                        const opts = sec.question_type === "true_false" ? ["T", "F"] : sec.question_type === "mcq5" ? ["A", "B", "C", "D", "E"] : ["A", "B", "C", "D"];
                        return (
                          <Select key={aIdx} value={ans} onValueChange={(v) => updateAnswer(sIdx, secIdx, aIdx, v)}>
                            <SelectTrigger className="w-9 h-9 p-0 text-xs font-bold">
                              <span className="mx-auto">{ans || (aIdx + 1)}</span>
                            </SelectTrigger>
                            <SelectContent>
                              {opts.map((o) => (
                                <SelectItem key={o} value={o}>{o}</SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        );
                      })}
                    </div>
                  </div>
                </div>
              ))}

              <Button
                variant="outline"
                size="sm"
                onClick={() => addSection(sIdx)}
                className="w-full gap-1"
              >
                <Plus className="w-3 h-3" /> Bo'lim qo'shish
              </Button>
            </div>
          ))}

          <Button variant="outline" onClick={addSubject} className="w-full gap-1">
            <Plus className="w-4 h-4" /> Fan qo'shish
          </Button>
        </div>

        <DialogFooter className="gap-2 sm:gap-0 pt-2 border-t">
          <Button type="button" variant="outline" onClick={() => setStep(1)}>
            <ChevronLeft className="w-4 h-4 mr-1" /> Orqaga
          </Button>
          <Button type="submit" disabled={loading}>
            {loading ? "Yaratilmoqda..." : "Yaratish"}
          </Button>
        </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
