import { useState } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery } from "@tanstack/react-query";
import { Card } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Trophy, TrendingUp, TrendingDown, Minus, Medal } from "lucide-react";
import { cn } from "@/lib/utils";

const medals = ["🥇", "🥈", "🥉"];

export default function Leaderboard() {
  const [filterTest, setFilterTest] = useState("all");
  const [filterClass, setFilterClass] = useState("all");

  const { data: results = [], isLoading } = useQuery({
    queryKey: ["results"],
    queryFn: () => base44.entities.TestResult.list("-total_score", 500),
  });

  const { data: tests = [] } = useQuery({
    queryKey: ["tests"],
    queryFn: () => base44.entities.Test.list("-created_date", 50),
  });

  const classes = [...new Set(results.map((r) => r.class_name).filter(Boolean))];

  const filtered = results.filter((r) => {
    if (filterTest !== "all" && r.test_id !== filterTest) return false;
    if (filterClass !== "all" && r.class_name !== filterClass) return false;
    return true;
  });

  // Aggregate by student
  const studentMap = {};
  filtered.forEach((r) => {
    const key = r.student_name;
    if (!studentMap[key]) {
      studentMap[key] = {
        name: r.student_name,
        class_name: r.class_name,
        totalScore: 0,
        totalMax: 0,
        totalCorrect: 0,
        totalWrong: 0,
        testCount: 0,
      };
    }
    studentMap[key].totalScore += r.total_score || 0;
    studentMap[key].totalMax += r.max_score || 0;
    studentMap[key].totalCorrect += r.correct_count || 0;
    studentMap[key].totalWrong += r.wrong_count || 0;
    studentMap[key].testCount++;
  });

  const leaderboard = Object.values(studentMap)
    .map((s) => ({
      ...s,
      percentage: s.totalMax > 0 ? Math.round((s.totalScore / s.totalMax) * 1000) / 10 : 0,
    }))
    .sort((a, b) => b.percentage - a.percentage || b.totalScore - a.totalScore);

  const totalStudents = leaderboard.length;

  return (
    <div className="max-w-4xl mx-auto px-4 md:px-8 py-6 md:py-8">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h2 className="text-2xl font-bold font-heading flex items-center gap-2">
            <Trophy className="w-6 h-6 text-yellow-500" /> Reyting
          </h2>
          <p className="text-muted-foreground text-sm mt-1">O'quvchilar reytingi va top-jadval</p>
        </div>
      </div>

      <div className="flex gap-3 mb-6 flex-wrap">
        <Select value={filterTest} onValueChange={setFilterTest}>
          <SelectTrigger className="w-48">
            <SelectValue placeholder="Barcha testlar" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Barcha testlar</SelectItem>
            {tests.map((t) => (
              <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={filterClass} onValueChange={setFilterClass}>
          <SelectTrigger className="w-36">
            <SelectValue placeholder="Barcha sinflar" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Barcha sinflar</SelectItem>
            {classes.map((c) => (
              <SelectItem key={c} value={c}>{c}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {isLoading ? (
        <div className="space-y-3">
          {[1, 2, 3, 4, 5].map((i) => (
            <Card key={i} className="p-4 animate-pulse">
              <div className="flex items-center gap-4">
                <div className="w-10 h-10 bg-muted rounded-full" />
                <div className="flex-1">
                  <div className="h-4 bg-muted rounded w-1/3 mb-2" />
                  <div className="h-3 bg-muted rounded w-1/4" />
                </div>
              </div>
            </Card>
          ))}
        </div>
      ) : leaderboard.length === 0 ? (
        <Card className="p-12 text-center">
          <Medal className="w-12 h-12 text-muted-foreground/40 mx-auto mb-4" />
          <h3 className="text-lg font-semibold mb-2">Hali natijalar yo'q</h3>
          <p className="text-muted-foreground text-sm">Skanerlash sahifasida natijalarni kiriting</p>
        </Card>
      ) : (
        <div className="space-y-2">
          {leaderboard.map((student, idx) => {
            const rank = idx + 1;
            const percentile = totalStudents > 1 ? Math.round(((totalStudents - rank) / (totalStudents - 1)) * 100) : 100;

            return (
              <Card
                key={student.name}
                className={cn(
                  "p-4 transition-all hover:shadow-md",
                  rank <= 3 && "border-primary/20 bg-primary/[0.02]"
                )}
              >
                <div className="flex items-center gap-4">
                  <div className={cn(
                    "w-10 h-10 rounded-full flex items-center justify-center text-lg font-bold shrink-0",
                    rank === 1 ? "bg-yellow-100 text-yellow-700" :
                    rank === 2 ? "bg-gray-100 text-gray-600" :
                    rank === 3 ? "bg-orange-100 text-orange-700" :
                    "bg-muted text-muted-foreground"
                  )}>
                    {rank <= 3 ? medals[rank - 1] : rank}
                  </div>

                  <div className="flex-1 min-w-0">
                    <p className="font-semibold truncate">{student.name}</p>
                    <p className="text-xs text-muted-foreground">{student.class_name} • {student.testCount} test</p>
                  </div>

                  <div className="hidden md:flex items-center gap-6 text-sm">
                    <div className="text-center">
                      <p className="font-bold text-green-600">{student.totalCorrect}</p>
                      <p className="text-[10px] text-muted-foreground">To'g'ri</p>
                    </div>
                    <div className="text-center">
                      <p className="font-bold text-red-500">{student.totalWrong}</p>
                      <p className="text-[10px] text-muted-foreground">Noto'g'ri</p>
                    </div>
                  </div>

                  <div className="text-right">
                    <p className="font-bold text-lg">{student.totalScore}</p>
                    <p className="text-xs text-muted-foreground">/ {student.totalMax}</p>
                  </div>

                  <div className="w-16 text-right">
                    <p className="font-bold text-primary">{student.percentage}%</p>
                    <p className="text-[10px] text-muted-foreground">Top {100 - percentile}%</p>
                  </div>
                </div>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}