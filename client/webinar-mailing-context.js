import {takeMailingContext} from './webinar-followup.js';

// Run before analytics. Preserve the form prefill only until the page consumes it.
globalThis.__hkWebinarMailing=takeMailingContext();
