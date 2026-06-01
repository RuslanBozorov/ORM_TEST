import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card } from "@/components/ui/card";

// Javob kalitini qo'lda kiritish uchun grid
// Har bir fan va bo'lim uchun alohida section

export default function AnswerInputGrid({ test, answers, setAnswers }) {
  if (!test?.subjects) return null;

  const handleAnswerChange = (sectionKey, questionIdx, value) => {
    setAnswers((prev) => {
      const sectionAnswers = { ...(prev[sectionKey] || {}) };
      sectionAnswers[questionIdx] = value;
      return { ...prev, [sectionKey]: sectionAnswers };
    });
  };

  return (
    <div className="space-y-4">
      {test.subjects.map((sub, subIdx) => (
        <div key={subIdx}>
          <h4 className="font-semibold text-sm mb-2 text-muted-foreground">{sub.name || `Fan ${subIdx + 1}`}</h4>
          {sub.sections?.map((sec, secIdx) => {
            const sectionKey = `${subIdx}-${secIdx}`;
            const opts = sec.question_type === "true_false"
              ? ["T", "F"]
              : sec.question_type === "mcq5"
                ? ["A", "B", "C", "D", "E"]
                : ["A", "B", "C", "D"];

            const count = sec.question_count || 0;
            const cols = count > 30 ? 4 : count > 20 ? 3 : 2;
            const perCol = Math.ceil(count / cols);

            return (
              <Card key={secIdx} className="p-4">
                <p className="text-xs font-medium text-muted-foreground mb-3">{sec.name} — {count} savol</p>
                <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-x-4 gap-y-2">
                  {Array.from({ length: cols }, (_, col) => {
                    const start = col * perCol;
                    const end = Math.min(start + perCol, count);
                    return Array.from({ length: end - start }, (_, i) => {
                      const qIdx = start + i;
                      const val = answers[sectionKey]?.[qIdx] || "";
                      return (
                        <div key={qIdx} className="flex items-center gap-2">
                          <span className="text-xs text-muted-foreground w-6 text-right">{qIdx + 1}.</span>
                          <Select value={val} onValueChange={(v) => handleAnswerChange(sectionKey, qIdx, v)}>
                            <SelectTrigger className="h-8 w-14 text-xs">
                              <SelectValue placeholder="—" />
                            </SelectTrigger>
                            <SelectContent>
                              {opts.map((o) => (
                                <SelectItem key={o} value={o}>{o}</SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                      );
                    });
                  })}
                </div>
              </Card>
            );
          })}
        </div>
      ))}
    </div>
  );
}
