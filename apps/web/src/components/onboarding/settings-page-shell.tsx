import { cn } from "@/lib/utils";

export function SettingsPageShell({
  eyebrow,
  title,
  description,
  sectionTitle,
  sectionDescription,
  children,
  aside,
}: {
  eyebrow: string;
  title: string;
  description: string;
  sectionTitle?: string;
  sectionDescription?: string;
  children: React.ReactNode;
  aside?: React.ReactNode;
}) {
  return (
    <main className="mx-auto flex w-full max-w-7xl flex-1 flex-col gap-8 px-4 pb-10 md:px-8">
      <header className="flex flex-col gap-3 pt-2">
        <p className="text-sm font-medium tracking-[0.24em] text-muted-foreground uppercase">
          {eyebrow}
        </p>
        <div className="flex flex-col gap-2">
          <h1 className="max-w-2xl text-4xl leading-tight font-semibold tracking-tight">
            {title}
          </h1>
          <p className="max-w-2xl text-base leading-7 text-muted-foreground">
            {description}
          </p>
        </div>
      </header>

      <div
        className={cn(
          "grid gap-8",
          aside ? "xl:grid-cols-[minmax(0,1fr)_320px]" : "xl:grid-cols-1",
        )}
      >
        <div className="flex flex-col gap-6">
          {sectionTitle || sectionDescription ? (
            <div className="flex flex-col gap-2">
              {sectionTitle ? (
                <h2 className="text-xl font-semibold tracking-tight">
                  {sectionTitle}
                </h2>
              ) : null}
              {sectionDescription ? (
                <p className="text-sm text-muted-foreground">
                  {sectionDescription}
                </p>
              ) : null}
            </div>
          ) : null}
          {children}
        </div>

        {aside ? <div className="xl:pt-16">{aside}</div> : null}
      </div>
    </main>
  );
}
