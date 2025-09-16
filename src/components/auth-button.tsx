"use client";

import { signIn, signOut } from "next-auth/react";
import { siDiscord } from "simple-icons/icons";
import { useRouter } from "next/navigation";
import Image from "next/image";

interface AuthButtonProps {
  isAuthenticated: boolean;
  userImage: string | null | undefined;
}

export function AuthButton({ isAuthenticated, userImage }: AuthButtonProps) {
  const router = useRouter();

  return isAuthenticated ? (
    <div className="hover:bg-gray-750 flex items-center gap-2 rounded-lg bg-gray-800 p-2 text-gray-300">
      {userImage && (
        <Image
          src={userImage}
          alt="User avatar"
          width={32}
          height={32}
          className="rounded-full"
        />
      )}
      <button
        onClick={() => {
          router.push("/");
          void signOut();
        }}
        className="flex w-full items-center justify-center p-1 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400"
      >
        Sign out
      </button>
    </div>
  ) : (
    <button
      onClick={() => void signIn("discord")}
      className="hover:bg-gray-750 flex w-full items-center justify-center gap-2 rounded-lg bg-gray-800 p-3 text-sm text-gray-300 focus:outline-none focus:ring-2 focus:ring-blue-400"
    >
      <svg className="h-4 w-4" viewBox="0 0 24 24" fill="currentColor">
        <path d={siDiscord.path} />
      </svg>
      Sign in
    </button>
  );
}
