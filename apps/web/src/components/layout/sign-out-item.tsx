"use client";

import { useFormStatus } from "react-dom";
import { Loader2, LogOut } from "lucide-react";

import { DropdownMenuItem } from "@/components/ui/dropdown-menu";

/**
 * Sign-out control inside the account dropdown.
 *
 * The dropdown item is rendered as the form's submit button so the action runs on click
 * without any client-side navigation. `onSelect` is prevented from closing the menu, because
 * unmounting the form mid-submit would cancel the request.
 */
export function SignOutItem() {
  const { pending } = useFormStatus();

  return (
    <DropdownMenuItem
      asChild
      disabled={pending}
      onSelect={(event) => {
        event.preventDefault();
      }}
    >
      <button type="submit" className="w-full">
        {pending ? <Loader2 className="animate-spin" aria-hidden /> : <LogOut aria-hidden />}
        {pending ? "Signing out…" : "Sign out"}
      </button>
    </DropdownMenuItem>
  );
}
