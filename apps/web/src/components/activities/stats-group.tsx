import type { ReactNode } from "react";

type StatGroupItem = {
  icon?: ReactNode;
  label: string;
  sub?: string;
  value: string;
};

function StatGroup({ items }: { items: StatGroupItem[] }) {
  return (
    <div className="divide-border grid grid-cols-3 divide-x">
      {items.map((item) => (
        <div key={item.label} className="px-5 py-4 first:pl-0 last:pr-0">
          <p className="text-muted-foreground mb-1 text-xs font-medium tracking-widest uppercase">
            {item.label}
          </p>
          <p className="text-2xl leading-none font-bold">{item.value}</p>
          {item.sub ? (
            <p className="text-muted-foreground mt-1 text-xs">{item.sub}</p>
          ) : null}
        </div>
      ))}
    </div>
  );
}

export { StatGroup };
