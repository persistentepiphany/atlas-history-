import { Catalogue, type Cluster, type Manifest, type Scenario } from './types';
import { loadScenario } from './scenario';
import { loadManifest } from './manifest';

export interface CatalogueClient {
  listClusters(): Promise<Cluster[]>;
  getScenario(eventId: string): Promise<Scenario>;
  getManifest(eventId: string): Promise<Manifest>;
}

/** Reads the catalogue and the scenario files served from the public root. */
export class LocalEventClient implements CatalogueClient {
  constructor(private base = '/') {}
  async listClusters(): Promise<Cluster[]> {
    const res = await fetch(this.base + 'catalogue.json');
    if (!res.ok) throw new Error('catalogue fetch failed');
    return Catalogue.parse(await res.json()).clusters;
  }
  getScenario(id: string) { return loadScenario(this.base + 'scenarios/' + id + '.json'); }
  getManifest(id: string) { return loadManifest(this.base + 'assets/' + id + '/manifest.json'); }
}

export class CompositeClient implements CatalogueClient {
  constructor(private clients: CatalogueClient[]) {}
  async listClusters() { return (await Promise.all(this.clients.map((c) => c.listClusters()))).flat(); }
  async getScenario(id: string) { for (const c of this.clients) { try { return await c.getScenario(id); } catch { /* next client */ } } throw new Error('no scenario ' + id); }
  async getManifest(id: string) { for (const c of this.clients) { try { return await c.getManifest(id); } catch { /* next client */ } } throw new Error('no manifest ' + id); }
}

export const catalogue: CatalogueClient = new CompositeClient([new LocalEventClient()]);
