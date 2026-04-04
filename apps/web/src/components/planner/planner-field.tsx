import type { ReactNode } from "react";

import { Label } from "@corex/ui/components/label";

type PlannerFieldProps = {
  label: string;
  children: ReactNode;
};

export function PlannerField(props: PlannerFieldProps) {
  return (
    <div className="grid gap-2">
      <Label>{props.label}</Label>
      {props.children}
    </div>
  );
}
