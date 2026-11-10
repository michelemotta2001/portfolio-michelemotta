/** Testo bilingue. Il sito parte in italiano; il pulsante IT/EN scambia i testi in pagina. */
export type Bi = { it: string; en: string };

export const bi = (it: string, en?: string): Bi => ({ it, en: en ?? it });

/** Stringhe dell'interfaccia comuni a tutte le pagine. */
export const ui = {
  works: bi('Lavori', 'Works'),
  about: bi('About', 'About'),
  path: bi('Percorso', 'Background'),
  contact: bi('Contatti', 'Contact'),
  collab: bi('Collaboriamo', 'Work together'),
  menu: bi('Menu', 'Menu'),
  close: bi('Chiudi', 'Close'),
  skip: bi('Salta al contenuto', 'Skip to content'),
  home: bi('Torna alla homepage', 'Back to homepage'),
  index: bi('Indice dei lavori', 'Index of works'),
  next: bi('Progetto successivo', 'Next project'),
  restart: bi('Ricomincia dal primo progetto', 'Back to the first project'),
  openProject: bi('Apri il progetto', 'Open the project'),
  role: bi('Ruolo', 'Role'),
  readArticle: bi('Leggi l’articolo', 'Read the article'),
  lineup: bi('Line up', 'Line up'),
  archive: bi('Archivio del progetto', 'Project archive'),
  plate: bi('Tavola', 'Plate'),
  plates: bi('tavole', 'plates'),
  yarns: bi('filati', 'yarns'),
  yarn: bi('Filato', 'Yarn'),
  count: bi('Titolo (NM)', 'Count (NM)'),
  composition: bi('Composizione', 'Composition'),
  scrollHint: bi('Scorri per sfogliare i look', 'Scroll to browse the looks'),
  look: bi('Look', 'Look'),
  contactsTitle: bi('Contatti per collaborazioni', 'Contact for collaborations'),
  allWorks: bi('Tutti i lavori', 'All works'),
  filterBy: bi('Filtra i lavori per categoria', 'Filter works by category'),
  shelfHint: bi('Passa sopra o tocca un volume per aprirlo', 'Hover or tap a volume to open it'),
  enlarge: bi('Ingrandisci', 'Enlarge'),
} satisfies Record<string, Bi>;

/** Mail precompilata del pulsante "Collaboriamo" (oggetto + traccia da completare). */
export const collabMail = {
  subject: bi('Proposta di collaborazione — dal tuo portfolio', 'Collaboration proposal — from your portfolio'),
  body: bi(
    [
      'Ciao Michele,',
      '',
      'ho visto il tuo portfolio su michlemotta.com e vorrei proporti una collaborazione.',
      '',
      'Chi sono / azienda:',
      'Progetto o ruolo:',
      'Tempistiche:',
      'Recapito:',
      '',
      'Un saluto,',
      '',
    ].join('\r\n'),
    [
      'Hi Michele,',
      '',
      'I came across your portfolio on michlemotta.com and I would like to propose a collaboration.',
      '',
      'Who I am / company:',
      'Project or role:',
      'Timeline:',
      'Contact:',
      '',
      'Best regards,',
      '',
    ].join('\r\n'),
  ),
};

/** mailto: con oggetto e corpo codificati (le righe vanno a capo anche su Gmail e Mail di iOS). */
export const mailtoHref = (email: string, subject: string, body: string) =>
  `mailto:${email}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
