/** Un prochain passage à un arrêt, tel qu'utilisé dans l'appli. */
export interface Passage {
  /** Code de l'arrêt TCL. */
  stopId: string;
  /** Ligne, par exemple « T1 ». */
  line: string;
  /** Terminus de la course. */
  direction: string;
  /** Heure de passage prévue. */
  departure: Date;
  /** Délai lisible fourni par TCL, par exemple « 3 min » ou « Proche ». */
  delayLabel: string;
  /** true si l'heure est estimée en temps réel, false si elle est théorique. */
  realtime: boolean;
}

export interface PassagesApi {
  /** Indique si l'appli tourne sur des données fictives. */
  readonly demo: boolean;
  /** Prochains passages d'une ligne à un arrêt, triés par heure. */
  getPassages(stopId: string, line: string): Promise<Passage[]>;
}
