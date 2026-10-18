import React from 'react';
import { PumpType } from '../types';
import { splitCatalogue, pumpTypeLabel } from '../engine/pumpCatalogue';

/**
 * Voci dei menù di scelta motopompa, sdoppiate in "Preferite" e "Catalogo":
 * i modelli con la stella restano in cima per un accesso immediato, tutti gli
 * altri restano comunque raggiungibili nello stesso elenco a tendina. Ogni
 * modello compare una sola volta, così la voce selezionata resta univoca.
 */
export const PumpOptions: React.FC<{ pumpTypes?: PumpType[] }> = ({ pumpTypes }) => {
  const { favourites, others } = splitCatalogue(pumpTypes);

  return (
    <>
      {favourites.length > 0 && (
        <optgroup label="Preferite">
          {favourites.map(p => (
            <option key={p.id} value={p.id}>
              {pumpTypeLabel(p)}
            </option>
          ))}
        </optgroup>
      )}
      {others.length > 0 && (
        <optgroup label="Catalogo">
          {others.map(p => (
            <option key={p.id} value={p.id}>
              {pumpTypeLabel(p)}
            </option>
          ))}
        </optgroup>
      )}
    </>
  );
};
