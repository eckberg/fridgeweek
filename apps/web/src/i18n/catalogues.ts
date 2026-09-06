/**
 * Importing this module makes every translation available to `t()`. English is
 * built into `index.ts` and is always the fallback, so a language that has not
 * covered a key yet still renders rather than breaking.
 *
 * Order follows `UI_LOCALES`.
 */
import { registerCatalogue } from './index.js';
import da from './locales/da.json';
import de from './locales/de.json';
import es from './locales/es.json';
import fi from './locales/fi.json';
import fo from './locales/fo.json';
import fr from './locales/fr.json';
import is from './locales/is.json';
import it from './locales/it.json';
import nb from './locales/nb.json';
import nl from './locales/nl.json';
import nn from './locales/nn.json';
import pl from './locales/pl.json';
import pt from './locales/pt.json';
import sv from './locales/sv.json';

registerCatalogue('sv', sv);
registerCatalogue('da', da);
registerCatalogue('nb', nb);
registerCatalogue('nn', nn);
registerCatalogue('fi', fi);
registerCatalogue('is', is);
registerCatalogue('fo', fo);
registerCatalogue('de', de);
registerCatalogue('es', es);
registerCatalogue('fr', fr);
registerCatalogue('it', it);
registerCatalogue('nl', nl);
registerCatalogue('pl', pl);
registerCatalogue('pt', pt);
