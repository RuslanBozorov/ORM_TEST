import { useState } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery } from "@tanstack/react-query";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis, Radar } from "recharts";
import { BarChart3, Users, BookOpen, AlertTriangle } from "lucide-react";

export default function Analytics() {
  const [filterTest, setFilterTest] = useState("all");

  const { data: results = [], isLoading } = useQuery({
    queryKey: ["results"],
    queryFn: () => base44.entities.TestResult.list("-created_date", 500),
  });

  const { data: tests = [] } = useQuery({
    queryKey: ["tests"],
    queryFn: () => base44.entities.Test.list("-created_date", 50),
  });

  const filtered = filterTest === "all" ? results : results.filter((r) => r.test_id === filterTest);

  // Subject-level analytics
  const subjectStats = {};
  filtered.forEach((r) => {
    r.subject_scores?.forEach((ss) => {
      if (!subjectStats[ss.subject_name]) {
        subjectStats[ss.subject_name] = { totalScore: 0, totalMax: 0, count: 0, correct: 0, wrong: 0 };
      }
      subjectStats[ss.subject_name].totalScore += ss.score || 0;
      subjectStats[ss.subject_name].totalMax += ss.max_score || 0;
      subjectStats[ss.subject_name].correct += ss.correct || 0;
      subjectStats[ss.subject_name].wrong += ss.wrong || 0;
      subjectStats[ss.subject_name].count++;
    });
  });

  const subjectData = Object.entries(subjectStats).map(([name, data]) => ({
    name,
    avgScore: data.count > 0 ? Math.round((data.totalScore / data.count) * 10) / 10 : 0,
    avgPercent: data.totalMax > 0 ? Math.round((data.totalScore / data.totalMax) * 100) : 0,
    avgCorrect: data.count > 0 ? Math.round(data.correct / data.count) : 0,
    avgWrong: data.count > 0 ? Math.round(data.wrong / data.count) : 0,
    totalStudents: data.count,
  }));

  const radarData = subjectData.map((s) => ({
    subject: s.name,
    "O'rtacha %": s.avgPercent,
    fullMark: 100,
  }));

  const overallAvg = filtered.length > 0
    ? Math.round(filtered.reduce((s, r) => s + (r.percentage || 0), 0) / filtered.length * 10) / 10
    : 0;

  const totalStudents = new Set(filtered.map((r) => r.student_name)).size;

  return (
    <div className="max-w-6xl mx-auto px-4 md:px-8 py-6 md:py-8">
      <div className="flex items-center justify-between mb-8 flex-wrap gap-4">
        <div>
          <h2 className="text-2xl font-bold font-heading flex items-center gap-2">
            <BarChart3 className="w-6 h-6 text-primary" /> Tahlil
          </h2>
          <p className="text-muted-foreground text-sm mt-1">Fanlar bo'yicha statistika va tahlil</p>
        </div>
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
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
        <Card className="p-5">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center">
              <BarChart3 className="w-5 h-5 text-primary" />
            </div>
            <div>
              <p className="text-2xl font-bold">{overallAvg}%</p>
              <p className="text-xs text-muted-foreground">O'rtacha ball</p>
            </div>
          </div>
        </Card>
        <Card className="p-5">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-green-100 flex items-center justify-center">
              <Users className="w-5 h-5 text-green-600" />
            </div>
            <div>
              <p className="text-2xl font-bold">{totalStudents}</p>
              <p className="text-xs text-muted-foreground">O'quvchilar</p>
            </div>
          </div>
        </Card>
        <Card className="p-5">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-blue-100 flex items-center justify-center">
              <BookOpen className="w-5 h-5 text-blue-600" />
            </div>
            <div>
              <p className="text-2xl font-bold">{subjectData.length}</p>
              <p className="text-xs text-muted-foreground">Fanlar</p>
            </div>
          </div>
        </Card>
        <Card className="p-5">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-orange-100 flex items-center justify-center">
              <AlertTriangle className="w-5 h-5 text-orange-600" />
            </div>
            <div>
              <p className="text-2xl font-bold">{filtered.length}</p>
              <p className="text-xs text-muted-foreground">Natijalar</p>
            </div>
          </div>
        </Card>
      </div>

      {subjectData.length === 0 ? (
        <Card className="p-12 text-center">
          <BarChart3 className="w-12 h-12 text-muted-foreground/40 mx-auto mb-4" />
          <h3 className="text-lg font-semibold mb-2">Hali ma'lumotlar yo'q</h3>
          <p className="text-muted-foreground text-sm">Skanerlash natijalaridan keyin tahlil ko'rinadi</p>
        </Card>
      ) : (
        <div className="grid md:grid-cols-2 gap-6">
          {/* Bar Chart */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Fanlar bo'yicha o'rtacha foiz</CardTitle>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={subjectData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                  <XAxis dataKey="name" tick={{ fontSize: 12 }} />
                  <YAxis domain={[0, 100]} tick={{ fontSize: 12 }} />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: "hsl(var(--card))",
                      border: "1px solid hsl(var(--border))",
                      borderRadius: "8px",
                    }}
                  />
                  <Bar dataKey="avgPercent" fill="hsl(var(--primary))" radius={[6, 6, 0, 0]} name="O'rtacha %" />
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

          {/* Radar Chart */}
          {radarData.length > 2 && (
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Fanlar taqqoslama grafigi</CardTitle>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={300}>
                  <RadarChart data={radarData}>
                    <PolarGrid stroke="hsl(var(--border))" />
                    <PolarAngleAxis dataKey="subject" tick={{ fontSize: 11 }} />
                    <PolarRadiusAxis domain={[0, 100]} tick={{ fontSize: 10 }} />
                    <Radar name="O'rtacha %" dataKey="O'rtacha %" stroke="hsl(var(--primary))" fill="hsl(var(--primary))" fillOpacity={0.2} />
                  </RadarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          )}

          {/* Subject Details */}
          <Card className="md:col-span-2">
            <CardHeader>
              <CardTitle className="text-base">Fanlar bo'yicha batafsil</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {subjectData.map((sub) => (
                  <div key={sub.name} className="flex items-center gap-4 p-3 bg-muted/50 rounded-lg">
                    <div className="flex-1">
                      <p className="font-semibold">{sub.name}</p>
                      <p className="text-xs text-muted-foreground">{sub.totalStudents} natija</p>
                    </div>
                    <div className="flex items-center gap-6 text-sm">
                      <div className="text-center">
                        <p className="font-bold">{sub.avgScore}</p>
                        <p className="text-[10px] text-muted-foreground">O'rtacha ball</p>
                      </div>
                      <div className="text-center">
                        <p className="font-bold text-green-600">{sub.avgCorrect}</p>
                        <p className="text-[10px] text-muted-foreground">To'g'ri</p>
                      </div>
                      <div className="text-center">
                        <p className="font-bold text-red-500">{sub.avgWrong}</p>
                        <p className="text-[10px] text-muted-foreground">Noto'g'ri</p>
                      </div>
                      <div className="w-20">
                        <div className="flex justify-between text-xs mb-1">
                          <span>{sub.avgPercent}%</span>
                        </div>
                        <div className="h-2 bg-muted rounded-full overflow-hidden">
                          <div
                            className="h-full bg-primary rounded-full transition-all"
                            style={{ width: `${sub.avgPercent}%` }}
                          />
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}