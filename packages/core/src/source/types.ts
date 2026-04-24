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
