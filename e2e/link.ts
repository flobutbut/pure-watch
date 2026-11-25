import { decodeLinkPayload } from '../src/core/config/link-codec';

/** The field payload of the configuration link in a URL, whatever its format. */
export function linkPayload(url: string): Record<string, unknown> {
  const payload = decodeLinkPayload(new URL(url).hash);
  if (!payload) throw new Error(`Pas de configuration dans ${url}`);
  return payload;
}
