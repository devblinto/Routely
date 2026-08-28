import { Brand } from "@/components/layout/brand";
import { routes } from "@/lib/routes";

/**
 * Shell for unauthenticated screens.
 *
 * A single centred column at every viewport. The page has exactly one job — get the visitor to
 * one button — so nothing competes with it horizontally, and the same layout works from a
 * phone to a wide desktop without a breakpoint switch.
 *
 * The background is two stacked decorative layers, both `aria-hidden` and behind the content:
 * a dot grid faded out at the edges by a mask, and a soft tint drawn from the theme's primary
 * token. They add depth without an image request or a fixed colour that would break in dark
 * mode.
 */
export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="relative flex min-h-screen flex-col overflow-hidden bg-background">
      <div aria-hidden className="pointer-events-none absolute inset-0">
        <div className="absolute -top-40 left-1/2 size-[36rem] -translate-x-1/2 rounded-full bg-primary/[0.06] blur-3xl" />
        <div className="absolute inset-0 [background-image:radial-gradient(circle,var(--border)_1px,transparent_1px)] [mask-image:radial-gradient(ellipse_70%_55%_at_50%_35%,#000,transparent)] [background-size:22px_22px] opacity-70" />
      </div>

      <main className="relative flex flex-1 flex-col items-center justify-center px-5 py-12 sm:px-6">
        <div className="w-full max-w-[25rem] space-y-7">
          <div className="flex justify-center">
            <Brand href={routes.home} size="lg" />
          </div>
          {children}
        </div>
      </main>

      <footer className="relative pb-8 text-center text-xs text-muted-foreground">
        © {new Date().getFullYear()} Routely
      </footer>
    </div>
  );
}
