import { useState } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Plus, FileText, Trash2, Eye, BookOpen } from "lucide-react";
import { format } from "date-fns";
import { Link } from "react-router-dom";
import CreateTestDialog from "@/components/tests/CreateTestDialog";

const statusMap = {
  draft: { label: "Qoralama", class: "bg-muted text-muted-foreground" },
  active: { label: "Faol", class: "bg-primary/10 text-primary" },
  completed: { label: "Tugatilgan", class: "bg-green-100 text-green-700" },
};

export default function Tests() {
  const [showCreate, setShowCreate] = useState(false);
  const queryClient = useQueryClient();

  const { data: tests = [], isLoading } = useQuery({
    queryKey: ["tests"],
    queryFn: () => base44.entities.Test.list("-created_date", 50),
  });

  const deleteMutation = useMutation({
    mutationFn: (id) => base44.entities.Test.delete(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["tests"] }),
  });

  return (
    <div className="max-w-6xl mx-auto px-4 md:px-8 py-6 md:py-8">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h2 className="text-2xl font-bold font-heading">Testlar</h2>
          <p className="text-muted-foreground text-sm mt-1">Barcha testlarni boshqaring</p>
        </div>
        <Button onClick={() => setShowCreate(true)} className="gap-2 shadow-md shadow-primary/20">
          <Plus className="w-4 h-4" />
          Yangi Test
        </Button>
      </div>

      {isLoading ? (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {[1, 2, 3].map((i) => (
            <Card key={i} className="p-6 animate-pulse">
              <div className="h-5 bg-muted rounded w-3/4 mb-3" />
              <div className="h-4 bg-muted rounded w-1/2 mb-2" />
              <div className="h-4 bg-muted rounded w-1/3" />
            </Card>
          ))}
        </div>
      ) : tests.length === 0 ? (
        <Card className="p-12 text-center">
          <BookOpen className="w-12 h-12 text-muted-foreground/40 mx-auto mb-4" />
          <h3 className="text-lg font-semibold mb-2">Hali testlar yo'q</h3>
          <p className="text-muted-foreground text-sm mb-6">Birinchi testingizni yarating</p>
          <Button onClick={() => setShowCreate(true)} className="gap-2">
            <Plus className="w-4 h-4" />
            Yangi Test Yaratish
          </Button>
        </Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {tests.map((test) => {
            const status = statusMap[test.status] || statusMap.draft;
            return (
              <Card key={test.id} className="p-5 hover:shadow-lg transition-shadow duration-300 group">
                <div className="flex items-start justify-between mb-3">
                  <Badge className={status.class}>{status.label}</Badge>
                  <button
                    onClick={() => deleteMutation.mutate(test.id)}
                    className="opacity-0 group-hover:opacity-100 transition-opacity text-muted-foreground hover:text-destructive"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
                <h3 className="font-semibold text-lg mb-1">{test.name}</h3>
                <p className="text-sm text-muted-foreground mb-3">
                  {test.class_name && `${test.class_name} • `}
                  {test.date && format(new Date(test.date), "dd.MM.yyyy")}
                </p>
                <div className="flex items-center gap-3 text-xs text-muted-foreground mb-4">
                  <span>{test.subjects?.length || 0} fan</span>
                  <span>•</span>
                  <span>{test.total_questions || 0} savol</span>
                  <span>•</span>
                  <span>{test.max_score || 0} ball</span>
                </div>
                <div className="flex gap-2">
                  <Link to={`/test/${test.id}`} className="flex-1">
                    <Button variant="outline" size="sm" className="w-full gap-1.5">
                      <Eye className="w-3.5 h-3.5" />
                      Ko'rish
                    </Button>
                  </Link>
                  <Link to={`/test/${test.id}/pdf`} className="flex-1">
                    <Button variant="outline" size="sm" className="w-full gap-1.5">
                      <FileText className="w-3.5 h-3.5" />
                      PDF
                    </Button>
                  </Link>
                </div>
              </Card>
            );
          })}
        </div>
      )}

      <CreateTestDialog open={showCreate} onOpenChange={setShowCreate} />
    </div>
  );
}