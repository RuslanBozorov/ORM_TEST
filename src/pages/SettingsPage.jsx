import { useState } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Download, Upload, Trash2, Database, AlertTriangle } from "lucide-react";
import { toast } from "sonner";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";

export default function SettingsPage() {
  const queryClient = useQueryClient();
  const [exporting, setExporting] = useState(false);

  const { data: tests = [] } = useQuery({
    queryKey: ["tests"],
    queryFn: () => base44.entities.Test.list("-created_date", 500),
  });

  const { data: results = [] } = useQuery({
    queryKey: ["results"],
    queryFn: () => base44.entities.TestResult.list("-created_date", 500),
  });

  const exportData = () => {
    setExporting(true);
    const data = {
      tests,
      results,
      exportDate: new Date().toISOString(),
      version: "1.0",
    };
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `test_nazorat_backup_${new Date().toISOString().split("T")[0]}.json`;
    a.click();
    URL.revokeObjectURL(url);
    setExporting(false);
    toast.success("Ma'lumotlar eksport qilindi!");
  };

  const exportResultsCSV = () => {
    if (results.length === 0) {
      toast.error("Natijalar yo'q");
      return;
    }

    const headers = ["O'quvchi", "Sinf", "Test", "Ball", "Maks", "Foiz", "To'g'ri", "Noto'g'ri"];
    const rows = results.map((r) => [
      r.student_name,
      r.class_name,
      r.test_name,
      r.total_score,
      r.max_score,
      r.percentage,
      r.correct_count,
      r.wrong_count,
    ]);

    const csv = [headers.join(","), ...rows.map((r) => r.join(","))].join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `natijalar_${new Date().toISOString().split("T")[0]}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success("CSV eksport qilindi!");
  };

  const clearAllResults = async () => {
    for (const r of results) {
      await base44.entities.TestResult.delete(r.id);
    }
    queryClient.invalidateQueries({ queryKey: ["results"] });
    toast.success("Barcha natijalar o'chirildi");
  };

  return (
    <div className="max-w-3xl mx-auto px-4 md:px-8 py-6 md:py-8">
      <div className="mb-8">
        <h2 className="text-2xl font-bold font-heading">Sozlamalar</h2>
        <p className="text-muted-foreground text-sm mt-1">Tizim sozlamalari va ma'lumotlarni boshqarish</p>
      </div>

      <div className="space-y-4">
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <Database className="w-4 h-4" /> Ma'lumotlar
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex items-center justify-between py-2">
              <div>
                <p className="font-medium text-sm">Testlar soni</p>
                <p className="text-xs text-muted-foreground">{tests.length} ta test</p>
              </div>
            </div>
            <div className="flex items-center justify-between py-2">
              <div>
                <p className="font-medium text-sm">Natijalar soni</p>
                <p className="text-xs text-muted-foreground">{results.length} ta natija</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <Download className="w-4 h-4" /> Eksport
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <Button variant="outline" className="w-full gap-2 justify-start" onClick={exportData}>
              <Download className="w-4 h-4" /> JSON Backup Eksport
            </Button>
            <Button variant="outline" className="w-full gap-2 justify-start" onClick={exportResultsCSV}>
              <Download className="w-4 h-4" /> Natijalarni CSV ga Eksport
            </Button>
          </CardContent>
        </Card>

        <Card className="border-destructive/30">
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2 text-destructive">
              <AlertTriangle className="w-4 h-4" /> Xavfli zona
            </CardTitle>
          </CardHeader>
          <CardContent>
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button variant="destructive" className="w-full gap-2">
                  <Trash2 className="w-4 h-4" /> Barcha natijalarni o'chirish
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Ishonchingiz komilmi?</AlertDialogTitle>
                  <AlertDialogDescription>
                    Barcha test natijalari o'chiriladi. Bu amalni ortga qaytarib bo'lmaydi.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Bekor qilish</AlertDialogCancel>
                  <AlertDialogAction onClick={clearAllResults}>Ha, o'chirish</AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}