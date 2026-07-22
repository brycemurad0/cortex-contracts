// Cortex NightCrewWorkPack — a batch of background read-only work items ($id v0).
//
// Per ADR-0014, contracts are authored once in cortex/contracts/ and imported by
// every consumer. NightCrewWorkPack represents a batch of work items for the
// nightly background loop, containing read-only analysis tasks.
//
// Keep paired with nightcrew-work-pack.schema.json. Bump $id on breaking changes.
//
// Status: DRAFT (v0). Authored 2026-05-31.

export type NightCrewItemKind =
  | "analyze"
  | "audit"
  | "index"
  | "harvest"
  | "verify"
  | "summarize";

export interface NightCrewWorkItem {
  /** The kind of work to perform. */
  kind: NightCrewItemKind;

  /** The target of the work (path, URL, identifier). */
  target: string;

  /** Rationale for why this item is in the pack. */
  rationale: string;
}

export interface NightCrewBudget {
  /** Maximum tokens that can be consumed for this pack. */
  max_tokens: number;

  /** Maximum USD cents that can be spent. */
  max_usd_cents: number;

  /** Maximum wall-clock time in seconds. */
  max_duration_seconds: number;
}

export interface NightCrewWorkPack {
  /** ULID/UUID — unique identifier for this work pack. */
  pack_id: string;

  /** When this pack was generated (ISO-8601 UTC). */
  generated_at: string;

  /** The work items in this pack. */
  items: NightCrewWorkItem[];

  /** Budget constraints for executing this pack. */
  budget: NightCrewBudget;

  /** Mnemos container for storing results. */
  container: string;
}
