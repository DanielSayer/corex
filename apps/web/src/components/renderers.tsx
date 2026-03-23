import type { ReactNode } from "react";
import Loader from "./loader";

type LoadingWrapperProps = {
  isLoading: boolean;
  fallback?: ReactNode;
  children: ReactNode;
};

function LoadingWrapper({
  isLoading,
  fallback = <Loader />,
  children,
}: LoadingWrapperProps) {
  if (isLoading) {
    return fallback;
  }

  return children;
}

export { LoadingWrapper };
