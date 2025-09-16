"use client";

import { useSession } from "next-auth/react";
import { AuthButton } from "./auth-button";

export function ClientAuthWrapper() {
  const { data: session, status } = useSession();
  
  // Show loading state while checking authentication
  if (status === "loading") {
    return (
      <div className="flex items-center justify-center rounded-lg bg-gray-800 p-3">
        <div className="h-4 w-4 animate-spin rounded-full border-2 border-gray-300 border-t-transparent"></div>
      </div>
    );
  }

  const isAuthenticated = !!session?.user;

  return (
    <AuthButton
      isAuthenticated={isAuthenticated}
      userImage={session?.user?.image}
    />
  );
}
