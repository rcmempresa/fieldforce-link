import { useState } from "react";
import { Check, ChevronsUpDown } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { matchesSearch } from "@/lib/searchText";
import { cn } from "@/lib/utils";

export interface MaterialCatalogOption {
  id: string;
  name: string;
  default_unit?: string | null;
  reference?: string | null;
}

interface MaterialCatalogSelectProps {
  options: MaterialCatalogOption[];
  value: string;
  onChange: (catalogId: string) => void;
  placeholder?: string;
  searchPlaceholder?: string;
  emptyLabel?: string;
}

/**
 * Material picker with a search box: type a name or reference and the list
 * narrows down. Accents and letter case are ignored.
 */
export function MaterialCatalogSelect({
  options,
  value,
  onChange,
  placeholder = "Escolher material...",
  searchPlaceholder = "Pesquisar por nome ou referência...",
  emptyLabel = "Nenhum material encontrado.",
}: MaterialCatalogSelectProps) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");

  const selected = options.find((o) => o.id === value);
  const filtered = options.filter((o) =>
    matchesSearch([o.name, o.reference, o.default_unit], search),
  );
  const MAX_SHOWN = 100;
  const shown = filtered.slice(0, MAX_SHOWN);

  return (
    <Popover
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (!next) setSearch("");
      }}
    >
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          role="combobox"
          aria-expanded={open}
          className="w-full justify-between font-normal"
        >
          <span className={cn("truncate text-left", !selected && "text-muted-foreground")}>
            {selected ? selected.name : placeholder}
          </span>
          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-full p-0" align="start">
        <Command shouldFilter={false}>
          <CommandInput
            value={search}
            onValueChange={setSearch}
            placeholder={searchPlaceholder}
          />
          <CommandList>
            <CommandEmpty>{emptyLabel}</CommandEmpty>
            <CommandGroup>
              {shown.map((item) => (
                <CommandItem
                  key={item.id}
                  value={item.id}
                  onSelect={() => {
                    onChange(item.id);
                    setOpen(false);
                    setSearch("");
                  }}
                >
                  <Check
                    className={cn(
                      "mr-2 h-4 w-4",
                      value === item.id ? "opacity-100" : "opacity-0",
                    )}
                  />
                  <span className="flex-1 truncate">{item.name}</span>
                  {item.reference && (
                    <span className="ml-2 shrink-0 text-xs text-muted-foreground">
                      Ref: {item.reference}
                    </span>
                  )}
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
          {filtered.length > MAX_SHOWN && (
            <p className="border-t px-3 py-2 text-xs text-muted-foreground">
              A mostrar os primeiros {MAX_SHOWN} de {filtered.length}. Escreve para
              filtrar.
            </p>
          )}
        </Command>
      </PopoverContent>
    </Popover>
  );
}
