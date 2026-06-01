import { useState } from "react";
import { useParams, Link } from "react-router-dom";
import { base44 } from "@/api/base44Client";
import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card } from "@/components/ui/card";
import { ArrowLeft, Download, Loader2 } from "lucide-react";
import { toast } from "sonner";
import jsPDF from "jspdf";

export default function PdfGenerator() {
  const { id } = useParams();
  const [copies, setCopies] = useState(1);
  const [variant, setVariant] = useState("A");
  const [generating, setGenerating] = useState(false);

  const { data: test, isLoading } = useQuery({
    queryKey: ["test", id],
    queryFn: async () => {
      const tests = await base44.entities.Test.filter({ id });
      return tests[0];
    },
  });

  const generatePdf = () => {
    if (!test) return;
    setGenerating(true);

    setTimeout(() => {
      for (let copy = 0; copy < copies; copy++) {
        const doc = new jsPDF("p", "mm", "a4");
        const pw = 210;
        const ph = 297;
        const margin = 15;
        const markerSize = 8;

        // Draw alignment markers
        const drawMarkers = () => {
          doc.setFillColor(0, 0, 0);
          doc.rect(margin - markerSize, margin - markerSize, markerSize, markerSize, "F");
          doc.rect(pw - margin, margin - markerSize, markerSize, markerSize, "F");
          doc.rect(margin - markerSize, ph - margin, markerSize, markerSize, "F");
          doc.rect(pw - margin, ph - margin, markerSize, markerSize, "F");
        };

        drawMarkers();

        // Header
        doc.setFontSize(14);
        doc.setFont(undefined, "bold");
        doc.text("TEST NAZORAT PRO", pw / 2, margin + 5, { align: "center" });
        doc.setFontSize(10);
        doc.setFont(undefined, "normal");
        doc.text(`Test: ${test.name}`, margin + 2, margin + 14);
        doc.text(`Variant: ${variant} (Set ${variant})`, pw - margin - 2, margin + 14, { align: "right" });

        // Student info fields
        let y = margin + 22;
        doc.setFontSize(9);
        doc.setDrawColor(180);
        const fields = ["Ism: ____________________________", `Sinf: ${test.class_name || "________"}`, `Sana: ${test.date || "________"}`, `Roll: ________`];
        doc.text(fields[0], margin + 2, y);
        doc.text(fields[1], pw / 2, y);
        y += 6;
        doc.text(fields[2], margin + 2, y);
        doc.text(fields[3], pw / 2, y);
        y += 4;

        doc.setDrawColor(0);
        doc.setLineWidth(0.5);
        doc.line(margin, y, pw - margin, y);
        y += 6;

        // Subjects and sections
        const circleR = 3.5;
        const gapX = 9;
        const gapY = 9;

        test.subjects?.forEach((sub) => {
          doc.setFontSize(10);
          doc.setFont(undefined, "bold");
          doc.text(sub.name || "Fan", margin + 2, y);
          y += 6;

          sub.sections?.forEach((sec) => {
            doc.setFontSize(8);
            doc.setFont(undefined, "bold");
            doc.text(`${sec.name} (${sec.question_count} savol)`, margin + 2, y);
            y += 5;
            doc.setFont(undefined, "normal");

            const isMcq = sec.question_type === "mcq4" || sec.question_type === "mcq5";
            const isTF = sec.question_type === "true_false";
            const options = isMcq ? (sec.question_type === "mcq4" ? ["A", "B", "C", "D"] : ["A", "B", "C", "D", "E"]) : isTF ? ["T", "F"] : null;

            const cols = options ? 2 : 3;
            const questionsPerCol = Math.ceil(sec.question_count / cols);

            for (let col = 0; col < cols; col++) {
              const startQ = col * questionsPerCol;
              const endQ = Math.min(startQ + questionsPerCol, sec.question_count);
              const colX = margin + 2 + col * ((pw - 2 * margin) / cols);

              for (let q = startQ; q < endQ; q++) {
                const rowY = y + (q - startQ) * gapY;

                if (rowY > ph - margin - 10) break;

                doc.setFontSize(7);
                doc.text(`${q + 1}.`, colX, rowY + 1);

                if (options) {
                  options.forEach((opt, oi) => {
                    const cx = colX + 10 + oi * gapX;
                    doc.setDrawColor(80);
                    doc.setLineWidth(0.3);
                    doc.circle(cx, rowY - 0.5, circleR);
                    doc.setFontSize(5.5);
                    doc.text(opt, cx, rowY + 0.5, { align: "center" });
                  });
                } else {
                  // Numerical boxes
                  const digits = sec.numerical_digits || 3;
                  for (let d = 0; d < digits; d++) {
                    const bx = colX + 10 + d * 8;
                    doc.setDrawColor(80);
                    doc.setLineWidth(0.3);
                    doc.rect(bx, rowY - 3.5, 6, 7);
                  }
                }
              }
            }

            y += questionsPerCol * gapY + 6;

            if (y > ph - 30) {
              doc.addPage();
              drawMarkers();
              y = margin + 10;
            }
          });
        });

        // Footer
        doc.setFontSize(7);
        doc.setTextColor(150);
        doc.text("Test Nazorat Pro — OMR Javob Varag'i", pw / 2, ph - margin + 5, { align: "center" });

        if (copy === copies - 1) {
          doc.save(`${test.name}_Variant_${variant}.pdf`);
        }
      }

      setGenerating(false);
      toast.success(`PDF muvaffaqiyatli yaratildi!`);
    }, 100);
  };

  if (isLoading) {
    return (
      <div className="max-w-2xl mx-auto px-4 md:px-8 py-8">
        <div className="animate-pulse space-y-4">
          <div className="h-8 bg-muted rounded w-1/3" />
          <div className="h-40 bg-muted rounded" />
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto px-4 md:px-8 py-6 md:py-8">
      <Link to={`/test/${id}`} className="text-sm text-muted-foreground hover:text-foreground flex items-center gap-1 mb-6">
        <ArrowLeft className="w-4 h-4" /> Testga qaytish
      </Link>

      <h2 className="text-2xl font-bold font-heading mb-2">PDF Javob Varag'i</h2>
      <p className="text-muted-foreground text-sm mb-8">{test?.name}</p>

      <Card className="p-6 space-y-6">
        <div className="grid grid-cols-2 gap-4">
          <div>
            <Label>Nusxalar soni</Label>
            <Input
              type="number"
              min="1"
              max="500"
              value={copies}
              onChange={(e) => setCopies(Math.max(1, parseInt(e.target.value) || 1))}
            />
          </div>
          <div>
            <Label>Variant</Label>
            <Select value={variant} onValueChange={setVariant}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="A">Set A</SelectItem>
                <SelectItem value="B">Set B</SelectItem>
                <SelectItem value="C">Set C</SelectItem>
                <SelectItem value="D">Set D</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        <div className="bg-muted/50 rounded-lg p-4 text-sm space-y-1">
          <p><strong>Fanlar:</strong> {test?.subjects?.map((s) => s.name).join(", ")}</p>
          <p><strong>Jami savollar:</strong> {test?.total_questions}</p>
          <p><strong>Maks ball:</strong> {test?.max_score}</p>
        </div>

        <Button onClick={generatePdf} disabled={generating} className="w-full gap-2 h-12 text-base">
          {generating ? (
            <>
              <Loader2 className="w-5 h-5 animate-spin" /> Yaratilmoqda...
            </>
          ) : (
            <>
              <Download className="w-5 h-5" /> PDF Yuklab Olish
            </>
          )}
        </Button>
      </Card>
    </div>
  );
}