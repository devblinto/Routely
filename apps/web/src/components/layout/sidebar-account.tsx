import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { SignOutButton } from "@/components/layout/sign-out-button";
import { signOutAction } from "@/server/auth/actions";
import type { SessionUser } from "@/server/auth/session";
import { cn } from "@/lib/utils";

function initials(user: Pick<SessionUser, "name" | "email">): string {
  const source = user.name?.trim() || user.email;
  const parts = source.split(/[\s@._-]+/).filter(Boolean);
  return parts
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? "")
    .join("");
}

/**
 * Who is signed in, and how to stop being signed in — pinned to the bottom of the sidebar.
 *
 * This replaced an avatar dropdown in the top bar. The dropdown held only a name, an email and
 * a sign-out item, so it cost a click to reach a two-line label and one action; here the same
 * information is simply visible, and signing out is one click instead of two. It also puts
 * account controls in the one column that is about *navigation and identity*, leaving the top
 * bar to the page.
 *
 * A Server Component wrapping a form, so signing out is a plain form submission to a Server
 * Action — it works with JavaScript disabled.
 */
export function SidebarAccount({
  user,
  collapsed = false,
  className,
}: {
  user: Pick<SessionUser, "name" | "email" | "image">;
  collapsed?: boolean;
  className?: string;
}) {
  return (
    <div className={cn("border-t border-border px-3 py-3", className)}>
      <div className="flex items-center gap-2.5 rounded-lg px-3 py-2">
        <Avatar className="size-7 shrink-0">
          {user.image ? <AvatarImage src={user.image} alt="" /> : null}
          <AvatarFallback className="text-[11px]">{initials(user)}</AvatarFallback>
        </Avatar>

        {/* Collapsed, the avatar alone identifies the account; the text folds away on the same
         * timing as the nav labels so the whole rail narrows as one movement. */}
        <div
          className={cn(
            "min-w-0 overflow-hidden transition-[max-width,opacity] duration-300 ease-in-out",
            collapsed ? "max-w-0 opacity-0" : "max-w-[160px] opacity-100",
          )}
        >
          <p className="truncate text-sm font-medium">{user.name ?? "Signed in"}</p>
          <p className="truncate text-xs text-muted-foreground">{user.email}</p>
        </div>
      </div>

      <form action={signOutAction}>
        <SignOutButton collapsed={collapsed} />
      </form>
    </div>
  );
}
