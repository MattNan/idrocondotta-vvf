export interface GPSPoint {
  timestamp: number;
  latitude: number;
  longitude: number;
  altitudeM: number;
  accuracyM: number;
  cumulativeDistM: number;
  cumulativeDiagM: number;
}

/**
 * Formula di Haversine per distanza sferica tra due coordinate [m]
 */
export function calculateHaversineDistance(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number
): number {
  const R = 6371000; // Raggio terra in metri
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

/** Un fix peggiore di questa accuratezza [m] viene scartato come inutilizzabile. */
export const MAX_ACCURACY_M = 60;
/** Spostamento minimo [m] perché un fix venga registrato (filtro rumore GPS). */
export const MIN_MOVE_M = 2;

/**
 * Tracker GPS del modo "sul campo".
 *
 * È separato in due fasi, come serve all'operatore:
 *  - `startWatch()` accende il GPS (solo lettura): serve a far agganciare i
 *    satelliti e a far scendere l'errore di posizionamento prima di partire;
 *  - `recordCurrentPoint()` salva la posizione corrente: la cadenza la decide
 *    la UI (a intervallo, a mano, in pausa, ripresa).
 *
 * Le distanze cumulative dei fix "live" sono calcolate rispetto all'ultimo
 * punto REGISTRATO, così il valore mostrato coincide con la progressiva reale.
 */
export class FieldGPSTracker {
  private watchId: number | null = null;
  private points: GPSPoint[] = [];
  private lastFix: GPSPoint | null = null;
  private onUpdate?: (fix: GPSPoint, points: GPSPoint[]) => void;
  private onError?: (error: GeolocationPositionError) => void;

  /**
   * Accende il GPS in sola lettura. Non registra nulla: aggiorna solo l'ultimo
   * fix disponibile (usato per precisione, quota e distanza "live").
   */
  public startWatch(
    onUpdate: (fix: GPSPoint, points: GPSPoint[]) => void,
    onError?: (error: GeolocationPositionError) => void
  ): boolean {
    if (!('geolocation' in navigator)) {
      alert('La geolocalizzazione GPS non è supportata da questo browser o dispositivo.');
      return false;
    }

    // già in ascolto: non duplicare il watch
    if (this.watchId !== null) {
      return true;
    }

    this.onUpdate = onUpdate;
    this.onError = onError;

    this.watchId = navigator.geolocation.watchPosition(
      (pos) => this.handlePosition(pos),
      (err) => {
        if (this.onError) this.onError(err);
      },
      {
        enableHighAccuracy: true,
        maximumAge: 1000,
        timeout: 15000
      }
    );

    return true;
  }

  /** Spegne il GPS e restituisce i punti registrati finora. */
  public stopWatch(): GPSPoint[] {
    if (this.watchId !== null) {
      navigator.geolocation.clearWatch(this.watchId);
      this.watchId = null;
    }
    this.lastFix = null;
    return this.points;
  }

  public isWatching(): boolean {
    return this.watchId !== null;
  }

  /** Ultimo fix valido con le distanze cumulative "live" (0 se non c'è ancora un fix). */
  public getLastFix(): GPSPoint | null {
    return this.lastFix;
  }

  public getRecordedPoints(): GPSPoint[] {
    return this.points;
  }

  /**
   * Registra la posizione corrente come nuovo punto del tracciato.
   * Restituisce il punto salvato, oppure `null` se non c'è un fix valido o se
   * ci si è mossi meno di `minMoveM` metri (rumore GPS). Passare `minMoveM = 0`
   * per forzare la registrazione (es. primo punto o punto battuto a mano).
   */
  public recordCurrentPoint(minMoveM: number = MIN_MOVE_M): GPSPoint | null {
    if (!this.lastFix) return null;

    const prev = this.points[this.points.length - 1];
    if (prev && minMoveM > 0) {
      const moved = calculateHaversineDistance(
        prev.latitude,
        prev.longitude,
        this.lastFix.latitude,
        this.lastFix.longitude
      );
      if (moved < minMoveM) return null;
    }

    const point = this.snapshot(this.lastFix);
    this.points.push(point);
    return point;
  }

  /** Annulla l'ultimo punto registrato (errore di battitura sul campo). */
  public removeLastPoint(): GPSPoint | null {
    return this.points.pop() ?? null;
  }

  public clearPoints(): void {
    this.points = [];
  }

  /**
   * Fotografa un fix calcolando le distanze cumulative rispetto all'ultimo
   * punto registrato (planimetrica e diagonale, che include la quota).
   */
  private snapshot(fix: GPSPoint): GPSPoint {
    const prev = this.points[this.points.length - 1];
    if (!prev) {
      return { ...fix, cumulativeDistM: 0, cumulativeDiagM: 0 };
    }

    const dPlan = calculateHaversineDistance(
      prev.latitude,
      prev.longitude,
      fix.latitude,
      fix.longitude
    );
    const dAlt = fix.altitudeM - prev.altitudeM;

    return {
      ...fix,
      cumulativeDistM: prev.cumulativeDistM + dPlan,
      cumulativeDiagM: prev.cumulativeDiagM + Math.sqrt(dPlan * dPlan + dAlt * dAlt)
    };
  }

  private handlePosition(position: GeolocationPosition) {
    const acc = position.coords.accuracy;
    if (acc > MAX_ACCURACY_M) {
      // Fix troppo scadente: non aggiorna né la posizione né la precisione mostrata.
      return;
    }

    const fix: GPSPoint = {
      timestamp: position.timestamp,
      latitude: position.coords.latitude,
      longitude: position.coords.longitude,
      altitudeM: position.coords.altitude ?? 0,
      accuracyM: acc,
      cumulativeDistM: 0,
      cumulativeDiagM: 0
    };

    // Le distanze cumulative del fix live partono dall'ultimo punto registrato.
    this.lastFix = this.snapshot(fix);

    if (this.onUpdate) {
      this.onUpdate(this.lastFix, this.points);
    }
  }
}
