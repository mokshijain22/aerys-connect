'use client';
import { useEffect, useRef } from 'react';
import { useLanguage } from '@/app/lib/LanguageContext';
import { autoDict } from '@/app/lib/autoTranslateDict';
import type { Lang } from '@/app/lib/translations';

// Caches the ORIGINAL English text for every text node & placeholder we touch,
// so we can restore it exactly when switching back to English.
const originalTextCache = new WeakMap<Text, string>();
const originalPlaceholderCache = new WeakMap<HTMLElement, string>();

function shouldSkip(node: Node): boolean {
  const parent = node.parentElement;
  if (!parent) return true;
  const tag = parent.tagName;
  if (tag === 'SCRIPT' || tag === 'STYLE' || tag === 'NOSCRIPT' || tag === 'TEXTAREA') return true;
  // Don't touch text typed inside inputs (React controls these separately anyway)
  if (parent.closest('input, textarea')) return true;
  return false;
}

function translateWord(original: string, lang: Lang): string {
  const trimmed = original.trim();
  if (!trimmed) return original;
  if (lang === 'en') return original;
  const hit = autoDict[trimmed]?.[lang];
  if (!hit) return original;
  // preserve surrounding whitespace from the original node
  const leading = original.slice(0, original.indexOf(trimmed));
  const trailing = original.slice(original.indexOf(trimmed) + trimmed.length);
  return leading + hit + trailing;
}

function walkAndTranslate(root: Node, lang: Lang) {
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, {
    acceptNode: (n) => (shouldSkip(n) ? NodeFilter.FILTER_REJECT : NodeFilter.FILTER_ACCEPT),
  });

  const textNodes: Text[] = [];
  let current = walker.nextNode();
  while (current) {
    textNodes.push(current as Text);
    current = walker.nextNode();
  }

  for (const node of textNodes) {
    const liveText = node.textContent || '';

    // In English mode, keep cache synced with live React output so dynamic
    // values (counts, timers, "Showing X of Y") don't get frozen to first render.
    if (lang === 'en') {
      originalTextCache.set(node, liveText);
      continue;
    }

    let original = originalTextCache.get(node);
    if (original === undefined) {
      original = liveText;
      originalTextCache.set(node, original);
    }

    const desired = translateWord(original, lang);
    if (node.textContent !== desired) {
      node.textContent = desired;
    }
  }

  // Placeholders on inputs/textareas
  const placeholderEls = (root instanceof Element ? root : document.body).querySelectorAll(
    'input[placeholder], textarea[placeholder]'
  );
  placeholderEls.forEach((el) => {
    const element = el as HTMLInputElement | HTMLTextAreaElement;
    const livePlaceholder = element.placeholder || '';

    if (lang === 'en') {
      originalPlaceholderCache.set(element, livePlaceholder);
      return;
    }

    let original = originalPlaceholderCache.get(element);
    if (original === undefined) {
      original = livePlaceholder;
      originalPlaceholderCache.set(element, original);
    }

    const desired = translateWord(original, lang);
    if (element.placeholder !== desired) {
      element.placeholder = desired;
    }
  });
}

export default function AutoTranslate({ children }: { children: React.ReactNode }) {
  const { lang } = useLanguage();
  const observerRef = useRef<MutationObserver | null>(null);
  const rafRef = useRef<number | null>(null);

  useEffect(() => {
    function runTranslate() {
      // Disconnect while we mutate the DOM so we don't observe our own edits
      observerRef.current?.disconnect();
      walkAndTranslate(document.body, lang);
      observerRef.current?.observe(document.body, {
        childList: true,
        subtree: true,
        characterData: true,
      });
    }

    function scheduleTranslate() {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      rafRef.current = requestAnimationFrame(runTranslate);
    }

    const observer = new MutationObserver(() => {
      scheduleTranslate();
    });
    observerRef.current = observer;

    // Initial pass
    runTranslate();

    return () => {
      observer.disconnect();
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
  }, [lang]);

  return <>{children}</>;
}