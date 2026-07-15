const svg=(body,viewBox='0 0 24 24')=>`<svg aria-hidden="true" viewBox="${viewBox}" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round">${body}</svg>`;
export const icons={
  app:svg('<path d="M12 2.6 20 7v10l-8 4.4L4 17V7z"/><circle cx="12" cy="12" r="2.1" fill="currentColor" stroke="none"/>'),
  strength:svg('<path d="M3 10v4M6 8v8M18 8v8M21 10v4M6 12h12"/>'),
  home:svg('<path d="m3 11 9-8 9 8"/><path d="M5 10v10h14V10"/>'),
  today:svg('<path d="M3 10v4M6 8v8M18 8v8M21 10v4M6 12h12"/>'),
  plan:svg('<path d="M7 5h14M7 12h14M7 19h14"/><circle cx="3" cy="5" r=".8" fill="currentColor" stroke="none"/><circle cx="3" cy="12" r=".8" fill="currentColor" stroke="none"/><circle cx="3" cy="19" r=".8" fill="currentColor" stroke="none"/>'),
  history:svg('<circle cx="12" cy="12" r="8.5"/><path d="M12 7v5l3 2"/>'),
  cardio:svg('<path d="M4 15c2-5 4-5 6 0s4 5 6 0 3-4 4-2"/><path d="M3 19h18"/>'),
  info:svg('<circle cx="12" cy="12" r="9"/><path d="M12 11v5"/><circle cx="12" cy="7.5" r=".7" fill="currentColor" stroke="none"/>'),
  swap:svg('<path d="M7 7h11l-3-3M17 17H6l3 3"/>'),
  cycling:svg('<circle cx="6" cy="16.5" r="3.3"/><circle cx="18" cy="16.5" r="3.3"/><path d="M6 16.5l5-8 7 8M11 8.5h5"/>'),
  hiking:svg('<path d="M7 4v8.4c0 1.5-.7 2.8-2 3.7L3.5 17a2.5 2.5 0 0 0 1.3 4.7h11.8a3.4 3.4 0 0 0 3.4-3.4v-1.1c0-1.3-.7-2.5-1.9-3.1l-5.6-2.8V7.6"/><path d="M7 8h5.5M7 11h5.5M6.2 17h13.3"/>'),
  challenge:svg('<circle cx="12" cy="12" r="8.5"/><circle cx="12" cy="12" r="4.5"/><circle cx="12" cy="12" r="1.1" fill="currentColor" stroke="none"/>'),
  settings:svg('<circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.9l.1.1-2.8 2.8-.1-.1a1.7 1.7 0 0 0-1.9-.3 1.7 1.7 0 0 0-1 1.6v.2h-4V21a1.7 1.7 0 0 0-1-1.6 1.7 1.7 0 0 0-1.9.3l-.1.1L4.2 17l.1-.1a1.7 1.7 0 0 0 .3-1.9A1.7 1.7 0 0 0 3 14H2.8v-4H3a1.7 1.7 0 0 0 1.6-1 1.7 1.7 0 0 0-.3-1.9L4.2 7 7 4.2l.1.1A1.7 1.7 0 0 0 9 4.6a1.7 1.7 0 0 0 1-1.6v-.2h4V3a1.7 1.7 0 0 0 1 1.6 1.7 1.7 0 0 0 1.9-.3l.1-.1L19.8 7l-.1.1a1.7 1.7 0 0 0-.3 1.9 1.7 1.7 0 0 0 1.6 1h.2v4H21a1.7 1.7 0 0 0-1.6 1z"/>'),
  back:svg('<path d="m15 18-6-6 6-6"/>'),
  chevron:svg('<path d="m9 18 6-6-6-6"/>'),
  export:svg('<path d="M12 3v12M8 7l4-4 4 4"/><path d="M5 13v7h14v-7"/>'),
  import:svg('<path d="M12 15V3M8 11l4 4 4-4"/><path d="M5 13v7h14v-7"/>'),
  trash:svg('<path d="M4 7h16M9 7V4h6v3M7 7l1 14h8l1-14"/>')
};
