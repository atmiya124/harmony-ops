'use client';

import { useEffect, useLayoutEffect, useRef } from 'react';
import { usePathname } from 'next/navigation';
import { directionBetween, sameScreen, type NavDirection } from './navDirection';

// Records which way the next navigation goes on <html data-nav="…">, so the
// view-transition CSS in globals.css can play a push, a pop or a crossfade.
//   - Link taps: decided from screen depth, or forced with data-nav on the
//     link (the bottom navigation always crossfades). React/Next run these
//     as view transitions through <Screen>.
//   - Browser / Android Back and Forward: React commits popstate
//     navigations synchronously (so scroll can be restored) and never gives
//     them a view transition. For those, this component starts the view
//     transition itself: it snapshots the current screen, then lets Next
//     handle the same popstate inside the transition. Next still performs
//     the navigation; only the animation is added.
//   - The browser's own gesture animation (iOS swipe-back), reduced motion
//     or no View Transitions support: no animation from us.
// It also remembers each screen's scroll position and restores it on Back,
// waiting for screens whose content loads after they appear.

const SCROLL_KEY = 'harmony.scroll.v1';

function setDirection(direction: NavDirection) {
  document.documentElement.dataset.nav = direction;
}

// Back to the crossfade default for navigations that don't come from a tap
// or Back — but never while a transition is still playing, which would
// switch its animation mid-flight (e.g. on a slow device).
function resetDirectionWhenIdle(): () => void {
  let timer = 0;
  const attempt = () => {
    const animating = document.getAnimations().some((a) => (a.effect as KeyframeEffect | null)?.pseudoElement?.startsWith('::view-transition'));
    if (animating) timer = window.setTimeout(attempt, 100);
    else setDirection('fade');
  };
  timer = window.setTimeout(attempt, 300);
  return () => window.clearTimeout(timer);
}

function readScroll(): Record<string, number> {
  try {
    return JSON.parse(sessionStorage.getItem(SCROLL_KEY) ?? '{}');
  } catch {
    return {};
  }
}

function saveScroll(pathname: string) {
  try {
    sessionStorage.setItem(SCROLL_KEY, JSON.stringify({ ...readScroll(), [pathname]: Math.round(window.scrollY) }));
  } catch {
    // Storage unavailable: Back simply starts at the top.
  }
}

// Instant, never animated: the CSS smooth scrolling would still be gliding
// when the screen transition captures the page.
function jumpTo(y: number) {
  window.scrollTo({ top: y, behavior: 'instant' });
}

// Scrolls to `y` as soon as the page is tall enough (content that loads after
// the screen appears), giving up after `timeoutMs`.
function restoreScroll(y: number, timeoutMs = 1500) {
  if (!y) return;
  const started = performance.now();
  const attempt = () => {
    const maxY = document.documentElement.scrollHeight - window.innerHeight;
    if (maxY >= y - 2) jumpTo(y);
    else if (performance.now() - started < timeoutMs) window.setTimeout(attempt, 50);
    else jumpTo(Math.max(0, maxY));
  };
  attempt();
}

function screenFor(pathname: string): HTMLElement | null {
  return document.querySelector(`[data-screen="${CSS.escape(pathname)}"]`);
}

// Resolves once the screen for `pathname` is in the DOM (or after a timeout).
function waitForScreen(pathname: string, timeoutMs = 1500): Promise<HTMLElement | null> {
  return new Promise((resolve) => {
    const started = performance.now();
    const poll = () => {
      const el = screenFor(pathname);
      if (el || performance.now() - started > timeoutMs) resolve(el);
      else window.setTimeout(poll, 16);
    };
    poll();
  });
}

function tag(el: HTMLElement | null, name: string, className: string) {
  if (!el) return;
  el.style.setProperty('view-transition-name', name);
  el.style.setProperty('view-transition-class', className);
}

function untag(el: HTMLElement | null) {
  el?.style.removeProperty('view-transition-name');
  el?.style.removeProperty('view-transition-class');
}

export default function NavDirectionTracker() {
  const pathname = usePathname();
  const current = useRef(pathname);
  const pendingRestore = useRef<number | null>(null);
  // Set while a Back/Forward navigation is being rendered: those restore
  // their own scroll position instead of starting at the top.
  const popping = useRef(false);

  useEffect(() => {
    let replaying = false;

    function onClick(e: MouseEvent) {
      if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
      const link = (e.target as Element | null)?.closest?.('a[href]') as HTMLAnchorElement | null;
      if (!link || (link.target && link.target !== '_self') || link.hasAttribute('download')) return;
      const url = new URL(link.href, window.location.href);
      if (url.origin !== window.location.origin || url.pathname === current.current) return;
      saveScroll(current.current);
      const forced = link.dataset.nav as NavDirection | undefined;
      setDirection(forced ?? directionBetween(current.current, url.pathname));
    }

    function onPopState(e: PopStateEvent) {
      if (replaying) return; // our own re-dispatch: let Next handle it
      const from = current.current;
      const to = window.location.pathname;
      if (from === to) return;
      popping.current = true;
      saveScroll(from);
      const target = readScroll()[to] ?? 0;
      const browserAnimated = (e as PopStateEvent & { hasUAVisualTransition?: boolean }).hasUAVisualTransition === true;
      const direction = browserAnimated ? 'none' : directionBetween(from, to);
      setDirection(direction);

      const canAnimate =
        !browserAnimated &&
        direction !== 'none' &&
        typeof document.startViewTransition === 'function' &&
        !window.matchMedia('(prefers-reduced-motion: reduce)').matches &&
        (e.state as { __NA?: boolean } | null)?.__NA === true;
      if (!canAnimate) {
        pendingRestore.current = target; // restored after Next renders the screen
        return;
      }

      // Hold Next's handler until the current screen has been snapshotted.
      e.stopImmediatePropagation();
      const oldScreen = screenFor(from);
      tag(oldScreen, 'nav-old-screen', 'screen-out');
      const state = e.state;
      const transition = document.startViewTransition(async () => {
        untag(oldScreen);
        replaying = true;
        try {
          window.dispatchEvent(new PopStateEvent('popstate', { state }));
        } finally {
          replaying = false;
        }
        const next = await waitForScreen(to);
        if (target) {
          const maxY = document.documentElement.scrollHeight - window.innerHeight;
          jumpTo(Math.min(target, Math.max(0, maxY)));
        }
        tag(next, 'nav-new-screen', 'screen-in');
      });
      transition.finished.finally(() => {
        untag(screenFor(to));
        untag(oldScreen);
        restoreScroll(target); // finish restoring if content was still loading
      });
    }

    // Capture phase: runs before Next.js handles the click / popstate.
    document.addEventListener('click', onClick, true);
    window.addEventListener('popstate', onPopState, true);
    return () => {
      document.removeEventListener('click', onClick, true);
      window.removeEventListener('popstate', onPopState, true);
    };
  }, []);

  // Every other navigation (a tap, router.push) opens the new screen at the
  // top. Next.js only resets scroll when it judges the new screen's top to
  // be off-screen, which isn't reliable while content loads in behind a
  // screen push. A layout effect, so it lands before the screen is shown.
  useLayoutEffect(() => {
    const from = current.current;
    if (from !== pathname && !popping.current && !sameScreen(from, pathname)) jumpTo(0);
    popping.current = false;
  }, [pathname]);

  useEffect(() => {
    current.current = pathname;
    if (pendingRestore.current !== null) {
      restoreScroll(pendingRestore.current);
      pendingRestore.current = null;
    }
    return resetDirectionWhenIdle();
  }, [pathname]);

  return null;
}
