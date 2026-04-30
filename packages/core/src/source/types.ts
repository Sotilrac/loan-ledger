/**
 * A `LoanSource` is the contract between the store and whatever is holding the
 * underlying `.loan.yaml`. The web app wires up FSA- and download-backed
 * sources; a Nextcloud target will provide an OCS-backed one. The store never
 * calls into the filesystem, File System Access API, or HTTP directly — it
 * asks the current source to read or write YAML text.
 */
export interface LoanSource {
  /**
   * Short identifier for this source kind. Used by the UI for branching
   * (e.g. whether to show a "Save to file" button) and for telemetry.
   * Known kinds in this repo: `demo`, `fsa`, `fallback`. Other targets may
   * add their own (e.g. `ocs`).
   */
  readonly kind: string;

  /** File-name or human label for the current entry. */
  readonly name: string;

  /**
   * Whether `write()` persists the YAML back to the original location
   * (FSA, OCS). When false, `write()` may still succeed but typically
   * means "download a copy" or "no-op".
   */
  readonly canWrite: boolean;

  /** Read the current YAML text. Called once when the source is attached. */
  read(): Promise<string>;

  /**
   * Persist the given YAML. For writable sources this saves back to the
   * same location; for read-only sources, implementations may throw or
   * fall back to a download.
   */
  write(yaml: string): Promise<void>;
}

/**
 * A `MappingsSource` is the analogous contract for the CSV column-mapping
 * library. The web app stores mappings in `localStorage` (per-browser, no
 * cross-device sync); the Nextcloud app stores them as a shared
 * `.mappings.yaml` at the Ledgers root so they travel with the loan files
 * and are visible to anyone the folder is shared with.
 *
 * The contract is YAML text in both directions, parsed and serialized via
 * `parseMappingsYaml` / `serializeMappingsYaml` from `@loan-ledger/core`.
 * An empty store is represented by an empty string from `read()`.
 */
export interface MappingsSource {
  /**
   * Short identifier for this source kind. Known kinds in this repo:
   * `local-storage`, `ocs`. Used by the UI to decide whether mappings are
   * device-local or shared, so it can label them honestly.
   */
  readonly kind: string;

  /** Human-readable label for the storage location. */
  readonly name: string;

  /**
   * Whether `write()` persists the YAML back to the underlying store.
   * Both current implementations are writable; the flag exists for symmetry
   * with `LoanSource` and to allow read-only fallbacks (e.g. when a shared
   * `.mappings.yaml` is mounted without write permission).
   */
  readonly canWrite: boolean;

  /**
   * Read the current mappings YAML text. Returns an empty string when the
   * store is empty or the underlying file does not exist yet — callers
   * should not treat that as an error.
   */
  read(): Promise<string>;

  /**
   * Persist the given mappings YAML. Implementations are responsible for
   * creating the underlying record on first write.
   */
  write(yaml: string): Promise<void>;
}
