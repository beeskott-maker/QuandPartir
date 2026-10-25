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
  /** Identifiant de la course (même tram d'un arrêt à l'autre), si connu. */
  course?: string;
}

/** Un arrêt d'une ligne : un nom, un ou plusieurs codes (un par quai ou sens). */
export interface Stop {
  name: string;
  ids: string[];
  /** Position de l'arrêt (moyenne de ses quais), si connue. */
  lat?: number;
  lon?: number;
}

export interface PassagesApi {
  /** Indique si l'appli tourne sur des données fictives. */
  readonly demo: boolean;
  /** Lignes proposées (codes TCL, par exemple « T1 »), triées. */
  getLines(): Promise<string[]>;
  /** Tous les passages annoncés sur une ligne (directions, ordre des arrêts). */
  getLinePassages(line: string): Promise<Passage[]>;
  /** Arrêts desservis par une ligne, triés par nom. */
  getStops(line: string): Promise<Stop[]>;
  /** Prochains passages d'une ligne à un arrêt (tous ses codes), triés par heure. */
  getPassages(stopIds: string[], line: string): Promise<Passage[]>;
}
