import { Button } from "@corex/ui/components/button";
import { Link, useCanGoBack, useRouter } from "@tanstack/react-router";
import { ArrowLeftIcon } from "lucide-react";

type BackButtonProps = {
  fallbacks: React.ComponentProps<typeof Link>;
};

function BackButton({ fallbacks }: BackButtonProps) {
  const router = useRouter();
  const canGoBack = useCanGoBack();

  if (canGoBack) {
    return (
      <Button
        variant="link"
        className="-ml-2.5"
        onClick={() => router.history.back()}
      >
        <ArrowLeftIcon className="size-4" />
        Back
      </Button>
    );
  }

  return (
    <Button
      variant="link"
      className="-ml-2.5"
      render={
        <Link {...fallbacks}>
          <ArrowLeftIcon className="size-4" />
          Back
        </Link>
      }
    />
  );
}

export { BackButton };
