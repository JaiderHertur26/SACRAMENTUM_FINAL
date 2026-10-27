// V223: a QA database must never be visually promoted by changing one Vercel flag.
// This identifier is a public Supabase project REF (not an API key or credential).
export const KNOWN_QA_PROJECT_REFS = Object.freeze(['foczofcmwampjvlfbsqn']);

export const projectRefFromUrl = (url) => {
  try {
    const parsed = new URL(String(url || ''));
    if (parsed.protocol !== 'https:') return null;
    const matched = parsed.hostname.match(/^([a-z0-9]{20})\.supabase\.co$/i);
    return matched ? matched[1].toLowerCase() : null;
  } catch {
    return null;
  }
};

export const isKnownTestRegistryProject = (url) =>
  KNOWN_QA_PROJECT_REFS.includes(projectRefFromUrl(url));

export const resolveRegistryTestMode = ({mode, url} = {}) =>
  mode !== 'official' || isKnownTestRegistryProject(url);
