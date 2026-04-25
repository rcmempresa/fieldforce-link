import { Button } from "@/components/ui/button";
import { ChevronLeft, ChevronRight } from "lucide-react";

interface DataPaginationProps {
  currentPage: number;
  totalPages: number;
  onPageChange: (page: number) => void;
  itemsPerPage: number;
  totalItems: number;
}

export function DataPagination({
  currentPage,
  totalPages,
  onPageChange,
  itemsPerPage,
  totalItems,
}: DataPaginationProps) {
  if (totalPages <= 1) return null;

  const startItem = (currentPage - 1) * itemsPerPage + 1;
  const endItem = Math.min(currentPage * itemsPerPage, totalItems);

  const pages = Array.from({ length: totalPages }, (_, i) => i + 1).filter(
    (page) =>
      page === 1 ||
      page === totalPages ||
      (page >= currentPage - 1 && page <= currentPage + 1)
  );

  return (
    <div className="flex flex-col sm:flex-row items-center justify-between gap-3 px-2 py-4 border-t">
      <div className="text-sm text-muted-foreground">
        A mostrar {startItem} a {endItem} de {totalItems} resultados
      </div>
      <div className="flex items-center space-x-2">
        <Button
          variant="outline"
          size="sm"
          onClick={() => onPageChange(currentPage - 1)}
          disabled={currentPage === 1}
        >
          <ChevronLeft className="h-4 w-4 mr-1" />
          Anterior
        </Button>
        <div className="flex items-center space-x-1">
          {pages.map((page, index) => (
            <div key={page} className="flex items-center">
              {index > 0 && pages[index - 1] !== page - 1 && (
                <span className="px-2 text-muted-foreground">...</span>
              )}
              <Button
                variant={currentPage === page ? "default" : "outline"}
                size="sm"
                onClick={() => onPageChange(page)}
                className="w-8 h-8 p-0"
              >
                {page}
              </Button>
            </div>
          ))}
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={() => onPageChange(currentPage + 1)}
          disabled={currentPage === totalPages}
        >
          Seguinte
          <ChevronRight className="h-4 w-4 ml-1" />
        </Button>
      </div>
    </div>
  );
}