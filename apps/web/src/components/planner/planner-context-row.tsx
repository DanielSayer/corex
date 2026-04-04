type PlannerContextRowProps = {
  label: string;
  value: string;
};

export function PlannerContextRow(props: PlannerContextRowProps) {
  return (
    <div className="flex items-center justify-between gap-3">
      <span className="text-muted-foreground">{props.label}</span>
      <span className="font-medium">{props.value}</span>
    </div>
  );
}
