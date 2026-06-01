import { useParams, Link } from "react-router-dom";
import { base44 } from "@/api/base44Client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ArrowLeft, FileText, CheckCircle2 } from "lucide-react";
import { format } from "date-fns";

const typeLabels = {
  mcq4: "MCQ (A-D)",
  mcq5: "MCQ (A-E)",
  true_false: "T/F",
  numerical: "Raqamli",
  integer: "Butun son",
};

export default function TestDetail() {
  const { id } = useParams();
  const queryClient = useQueryClient();

  const { data: test, isLoading } = useQuery({
    queryKey: ["test", id],
    queryFn: async () => {
      const tests = await base44.entities.Test.filter({ id });
      return tests[0];
    },
  });

  const activateMutation = useMutation({
    mutationFn: () => base44.entities.Test.update(id, { status: "active" }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["test", id] }),
  });

  if (isLoading) {
    return (
      <div className="max-w-4xl mx-auto px-4 md:px-8 py-8">
        <div className="animate-pulse space-y-4">
          <div className="h-8 bg-muted rounded w-1/3" />
          <div className="h-4 bg-muted rounded w-1/4" />
          <div className="h-40 bg-muted rounded" />
        </div>
      </div>
    );
  }

  if (!test) {
    return (
      <div className="max-w-4xl mx-auto px-4 md:px-8 py-8 text-center">
        <p className="text-muted-foreground">Test topilmadi</p>
        <Link to="/">
          <Button variant="outline" className="mt-4">Orqaga</Button>
        </Link>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto px-4 md:px-8 py-6 md:py-8">
      <Link to="/" className="text-sm text-muted-foreground hover:text-foreground flex items-center gap-1 mb-6">
        <ArrowLeft className="w-4 h-4" /> Testlar
      </Link>

      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8">
        <div>
          <h2 className="text-2xl font-bold font-heading">{test.name}</h2>
          <p className="text-muted-foreground text-sm mt-1">
            {test.class_name && `${test.class_name} • `}
            {test.date && format(new Date(test.date), "dd.MM.yyyy")} •{" "}
            {test.total_questions} savol • {test.max_score} ball
          </p>
        </div>
        <div className="flex gap-2">
          {test.status === "draft" && (
            <Button onClick={() => activateMutation.mutate()} className="gap-2">
              <CheckCircle2 className="w-4 h-4" /> Faollashtirish
            </Button>
          )}
          <Link to={`/test/${test.id}/pdf`}>
            <Button variant="outline" className="gap-2">
              <FileText className="w-4 h-4" /> PDF Varaq
            </Button>
          </Link>
        </div>
      </div>

      <div className="space-y-4">
        {test.subjects?.map((sub, subIdx) => (
          <Card key={subIdx} className="p-5">
            <h3 className="font-semibold text-lg mb-3">{sub.name || `Fan ${subIdx + 1}`}</h3>
            <div className="space-y-3">
              {sub.sections?.map((sec, secIdx) => (
                <div key={secIdx} className="bg-muted/50 rounded-lg p-4">
                  <div className="flex items-center justify-between mb-2">
                    <span className="font-medium text-sm">{sec.name}</span>
                    <div className="flex gap-2 text-xs">
                      <Badge variant="outline">{typeLabels[sec.question_type]}</Badge>
                      <Badge variant="outline">{sec.question_count} savol</Badge>
                      <Badge variant="outline">+{sec.correct_score} / {sec.wrong_score}</Badge>
                    </div>
                  </div>
                  {sec.answers?.length > 0 && (
                    <div className="flex flex-wrap gap-1.5 mt-2">
                      {sec.answers.slice(0, sec.question_count).map((ans, i) => (
                        <span
                          key={i}
                          className="w-7 h-7 flex items-center justify-center bg-primary/10 text-primary text-xs font-bold rounded-full"
                        >
                          {ans || "—"}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </Card>
        ))}
      </div>
    </div>
  );
}