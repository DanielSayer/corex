import { Button } from "@corex/ui/components/button";
import { Input } from "@corex/ui/components/input";
import { Label } from "@corex/ui/components/label";
import { useForm } from "@tanstack/react-form";
import { useNavigate } from "@tanstack/react-router";
import { toast } from "sonner";
import z from "zod";

import { authClient } from "@/lib/auth-client";

import Loader from "./loader";

export default function SignUpForm({
  onSwitchToSignIn,
}: {
  onSwitchToSignIn: () => void;
}) {
  const navigate = useNavigate({
    from: "/",
  });
  const { isPending } = authClient.useSession();

  const form = useForm({
    defaultValues: {
      email: "",
      password: "",
      name: "",
    },
    onSubmit: async ({ value }) => {
      await authClient.signUp.email(
        {
          email: value.email,
          password: value.password,
          name: value.name,
        },
        {
          onSuccess: () => {
            navigate({
              to: "/dashboard",
            });
            toast.success("Sign up successful");
          },
          onError: (error) => {
            toast.error(error.error.message || error.error.statusText);
          },
        },
      );
    },
    validators: {
      onSubmit: z.object({
        name: z.string().min(2, "Name must be at least 2 characters"),
        email: z.email("Invalid email address"),
        password: z.string().min(8, "Password must be at least 8 characters"),
      }),
    },
  });

  if (isPending) {
    return <Loader />;
  }

  return (
    <main className="grid min-h-svh lg:grid-cols-[minmax(0,1.05fr)_minmax(420px,0.95fr)]">
      <section className="relative hidden overflow-hidden border-r border-border/70 bg-muted/20 px-10 py-12 lg:flex lg:flex-col lg:justify-between">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_bottom_left,hsl(var(--accent)/0.2),transparent_35%),linear-gradient(180deg,transparent,transparent_50%,hsl(var(--primary)/0.14))]" />
        <div className="relative space-y-16">
          <div className="text-3xl font-extrabold italic tracking-tight">
            corex
          </div>
          <div className="max-w-xl space-y-6">
            <p className="text-sm font-medium tracking-[0.22em] text-muted-foreground uppercase">
              Get started
            </p>
            <h1 className="text-5xl font-semibold tracking-tight text-balance">
              Build your training system from goals outward.
            </h1>
            <p className="max-w-lg text-base leading-7 text-muted-foreground">
              Start with the target, connect your Intervals data, and shape the
              week around real availability instead of guesswork.
            </p>
          </div>
        </div>
        <div className="relative flex gap-8 border-t border-border/70 pt-6 text-sm">
          <div>
            <div className="font-medium">Clear setup flow</div>
            <div className="text-muted-foreground">
              Goals, credentials, sync
            </div>
          </div>
          <div>
            <div className="font-medium">Less clutter</div>
            <div className="text-muted-foreground">
              Hierarchy over dashboard cards
            </div>
          </div>
        </div>
      </section>

      <section className="flex items-center px-6 py-10 md:px-10 lg:px-14">
        <div className="mx-auto flex w-full max-w-md flex-col gap-8">
          <div className="space-y-3">
            <p className="text-sm font-medium tracking-[0.22em] text-muted-foreground uppercase">
              Create account
            </p>
            <h2 className="text-4xl font-semibold tracking-tight">
              Start your workspace
            </h2>
            <p className="text-sm leading-6 text-muted-foreground">
              Create an account to set goals, connect history, and configure the
              week ahead.
            </p>
          </div>

          <form
            onSubmit={(e) => {
              e.preventDefault();
              e.stopPropagation();
              form.handleSubmit();
            }}
            className="space-y-6"
          >
            <div>
              <form.Field name="name">
                {(field) => (
                  <div className="space-y-2">
                    <Label htmlFor={field.name}>Name</Label>
                    <Input
                      id={field.name}
                      name={field.name}
                      value={field.state.value}
                      onBlur={field.handleBlur}
                      onChange={(e) => field.handleChange(e.target.value)}
                    />
                    {field.state.meta.errors.map((error) => (
                      <p key={error?.message} className="text-red-500">
                        {error?.message}
                      </p>
                    ))}
                  </div>
                )}
              </form.Field>
            </div>

            <div>
              <form.Field name="email">
                {(field) => (
                  <div className="space-y-2">
                    <Label htmlFor={field.name}>Email</Label>
                    <Input
                      id={field.name}
                      name={field.name}
                      type="email"
                      value={field.state.value}
                      onBlur={field.handleBlur}
                      onChange={(e) => field.handleChange(e.target.value)}
                    />
                    {field.state.meta.errors.map((error) => (
                      <p key={error?.message} className="text-red-500">
                        {error?.message}
                      </p>
                    ))}
                  </div>
                )}
              </form.Field>
            </div>

            <div>
              <form.Field name="password">
                {(field) => (
                  <div className="space-y-2">
                    <Label htmlFor={field.name}>Password</Label>
                    <Input
                      id={field.name}
                      name={field.name}
                      type="password"
                      value={field.state.value}
                      onBlur={field.handleBlur}
                      onChange={(e) => field.handleChange(e.target.value)}
                    />
                    {field.state.meta.errors.map((error) => (
                      <p key={error?.message} className="text-red-500">
                        {error?.message}
                      </p>
                    ))}
                  </div>
                )}
              </form.Field>
            </div>

            <form.Subscribe
              selector={(state) => ({
                canSubmit: state.canSubmit,
                isSubmitting: state.isSubmitting,
              })}
            >
              {({ canSubmit, isSubmitting }) => (
                <Button
                  type="submit"
                  className="w-full"
                  disabled={!canSubmit || isSubmitting}
                >
                  {isSubmitting ? "Submitting..." : "Sign Up"}
                </Button>
              )}
            </form.Subscribe>
          </form>

          <div className="border-t border-border/70 pt-4">
            <Button
              variant="link"
              onClick={onSwitchToSignIn}
              className="px-0 text-foreground hover:text-foreground/80"
            >
              Already have an account? Sign In
            </Button>
          </div>
        </div>
      </section>
    </main>
  );
}
