import { Button } from "@corex/ui/components/button";
import { Label } from "@corex/ui/components/label";
import {
  ToggleGroup,
  ToggleGroupItem,
} from "@corex/ui/components/toggle-group";

import { cn } from "@/lib/utils";

export function FieldBlock({
  label,
  error,
  className,
  children,
}: {
  label: string;
  error?: string;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <div className={cn("flex flex-col gap-3", className)}>
      <Label>{label}</Label>
      {children}
      <FieldError error={error} />
    </div>
  );
}

export function FieldError({ error }: { error?: string }) {
  if (!error) {
    return null;
  }

  return <p className="text-sm text-destructive">{error}</p>;
}

export function SummaryRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-8">
      <div className="text-sm text-muted-foreground">{label}</div>
      <div className="text-sm font-medium">{value}</div>
    </div>
  );
}

export function LargeToggleGroup({
  value,
  options,
  onChange,
}: {
  value: string;
  options: Array<{
    value: string;
    label: string;
    icon?: React.ComponentType<React.SVGProps<SVGSVGElement>>;
  }>;
  onChange: (value: string) => void;
}) {
  return (
    <ToggleGroup
      className="grid w-full grid-cols-2 gap-0 divide-x divide-border/70 border-y border-border/70"
      spacing={12}
      value={[value]}
      onValueChange={(nextValue) => {
        const selected = nextValue[0];

        if (selected) {
          onChange(selected);
        }
      }}
    >
      {options.map((option) => {
        const Icon = option.icon;

        return (
          <ToggleGroupItem
            key={option.value}
            value={option.value}
            variant="outline"
            className="h-20 w-full flex-col items-start justify-center gap-2 rounded-none border-0 px-5 text-left shadow-none"
          >
            {Icon ? <Icon /> : null}
            <span>{option.label}</span>
          </ToggleGroupItem>
        );
      })}
    </ToggleGroup>
  );
}

export function SelectionTile({
  title,
  description,
  icon: Icon,
  selected,
  onClick,
}: {
  title: string;
  description: string;
  icon: React.ComponentType<React.SVGProps<SVGSVGElement>>;
  selected: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "flex min-h-32 flex-col items-start gap-4 border-b border-border/70 px-2 py-5 text-left transition-colors outline-none last:border-b-0",
        selected
          ? "text-foreground"
          : "text-muted-foreground hover:text-foreground",
      )}
    >
      <div
        className={cn(
          "inline-flex size-11 items-center justify-center rounded-2xl",
          selected
            ? "bg-primary text-primary-foreground"
            : "bg-secondary text-foreground",
        )}
      >
        <Icon />
      </div>
      <div className="flex flex-col gap-1">
        <div className="text-base font-medium tracking-tight">{title}</div>
        <div className="text-sm leading-6 text-muted-foreground">
          {description}
        </div>
      </div>
    </button>
  );
}

export function QuickPickButton({
  preset,
  isSelected,
  onClick,
}: {
  preset: number;
  isSelected: boolean;
  onClick: () => void;
}) {
  return (
    <Button
      size="sm"
      variant={isSelected ? "default" : "outline"}
      onClick={onClick}
    >
      {preset} min
    </Button>
  );
}
