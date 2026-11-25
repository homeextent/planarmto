# C.1C R5.1–R5.2 implementation and evidence

Independent review candidate. [Coordinated specification](c1c-r5-coordinated-specification.md) governs this work. [R5.3 design](c1c-r5-3-persistence-design.md) is a separate proposal awaiting approval.

## Accepted-build reproduction

On application baseline `cd782e7`, the synthetic Chromium case selected an established wall endpoint from 5 screen pixels away. The new wall snapped to the exact endpoint while the source wall and its ownership were preserved. The accepted canvas rendered the wall line and footprint without a distinct endpoint affordance. This confirmed a discoverability issue with working endpoint snapping.

Returning to the first point in continuous wall mode produced a geometric loop of separately committed wall segments with distinct assembly IDs. The mode exposed no perimeter completion action. The single-segment history was working as designed. The implementation retains it for independent construction and adds an explicit transient perimeter tracing path through **Trace continuous perimeter**. Ownership is assigned only after validated preview and Apply, using the existing generated-perimeter contract. Evidence is in `/tmp/planarmto-r5/baseline.log` and `/tmp/planarmto-r5/baseline-artifacts`.

## R5.1 requirement register

| ID | Implementation and evidence |
|---|---|
| R51-01 | Dedicated canvas rectangle with click-click placement, live draft and dimensions, then configure/preview/apply. The graphical rectangle browser case returns 27.1276 CY without supplying coordinates. The advanced coordinate generator remains available. |
| R51-02 | Keyboard width and depth correct the uncommitted outline about its anchor. The rectangle test checks dimensions to 10 decimal places, 27.1276 CY, one undo step, and exact redo record equality. |
| R51-03 | Simple orthogonal perimeter tracing reuses the existing geometry validator and exact perimeter generator. The irregular browser cases and existing L/T/U and offset numerical regressions cover the supported engine contract. |
| R51-04 | Distinct first-node ring, prospective edge cue and visible snapped status. The continuous trace test approaches the first vertex off-centre and verifies the snap and closure path. |
| R51-05 | Existing centreline wall endpoints render as markers in independent centreline wall drafting. The endpoint test verifies the visible snap status, canonical endpoint equality, unchanged source wall and independent IDs. Face-reference tracing retains its existing separate source-face contract. |
| R51-06 | Explicit continuous perimeter action opens the transient orthogonal trace. Validation precedes configuration and Apply is the only assembly creation step. The continuous trace case verifies transition to configuration without entity writes. Existing irregular browser coverage applies and undoes the resulting assembly. |
| R51-07 | Diagonal, repeated, invalid or redundant perimeter edges give a diagnostic. The trace remains recoverable through **Remove last vertex** or cancellation. The continuous trace case verifies rejection, correction and cancel with no saved draft geometry. |
| R51-08 | Exterior, centreline and interior reference choices pass unchanged to the exact perimeter generator. Browser tests exercise exterior and interior; the existing numerical tests exercise all bases and preserve isolated angled/faced walls. |
| R51-09 | Drafting and zoom operate in the existing calibrated world transform. A synthetic SVG browser test calibrates to 40 ft, fits and zooms, traces and edits a rectangle, exports/reopens, and verifies the whole foundation workspace equals the saved workspace. Real-plan owner acceptance remains open. |
| R51-10 | Existing six Node suites and full Chromium suite retain the baseline assertions. The production build continues using the existing geometry and measurement engines. |

## R5.2 requirement register

| ID | Implementation and evidence |
|---|---|
| R52-01 | Foundation length, height and datum fields accept ft/in or m. Construction sections and drainage offset use inches or mm. Advanced absolute project coordinates retain explicit canonical feet. Pipe diameter awaits an approved persisted specification field. The existing takeoff summaries still present canonical quantity units. Metric quantity presentation belongs in the reviewed summary work. |
| R52-02 | Foundation unit parser and exact keyboard entry accept feet/inches, mixed fractional inches, bare values and explicit unit suffixes. The parser and browser tests cover signed, zero, valid and malformed inputs. |
| R52-03 | Unit switches change presentation only. Form state holds canonical feet and unedited display rounding never feeds an Apply. The metric browser test compares the exported entity before and after a no-op save. |
| R52-04 | Properties, envelope and drainage controls offer context-specific catalogue choices. Strip and generated perimeter concrete retain their existing single supported material. Excavation description remains explicit free text. |
| R52-05 | Existing independent layer derivations continue to generate source-linked contributions. Coherent multi-material assembly quantities and separate internal identity across coordinated layers await R5.3–R5.6. No aggregate measurement or duplicate-prevention contract was changed. |
| R52-06 | Other material selection requires a nonblank description within a supported component category. The browser test verifies empty rejection and explicit custom insulation save. Custom category identity and attributes beyond the existing component purpose and material string await R5.3. |
| R52-07 | Historical strings remain visible as saved material, with no implicit aliasing. Import and no-op-save browser coverage preserves the exact historical concrete-block entity fields. |
| R52-08 | Historical unsupported concrete remains unquantified. The approved poured-concrete choice is the sole new concrete selection. Engine eligibility is unchanged. |
| R52-09 | Catalogue choices write existing material strings. An envelope or drainage generator can derive a compatible layer identity from its material when left blank. Historical and advanced overrides remain available. Full standard assembly identity management and inspector consolidation await their approved increments. |
| R52-10 | All prior quantity, persistence and regression assertions retained. Browser fixture actions now select approved catalogue choices and send explicit feet to fields displaying inches. Those changes preserve the measured quantities and geometry asserted by the original tests. |

## Later package coverage

R53-D01–D15 and R54-01–16 inform the proposed type, storage and transaction contracts in the design document. Those fields, defaults, ownership and regeneration behaviors are deferred for independent persistence review and implementation. R55-01–12 and R56-01–06 remain later acceptance tracks. This candidate contributes existing-regression assurance and targeted R5.1–R5.2 evidence only. The full CA01–CA12 owner exercise remains open.

## Local verification

Application commit: `92a8447d184be40240a9464070aadab6a6c667ba`. Node 22.23.5 local validation passed **296/296** (213 Node and 83 Chromium). The locked install, production build, dependency audit (zero findings), Chromium installation, PHP lint and PDF worker checks passed. The first full validation exposed TypeScript-only errors in the new control props and readonly catalogue typing. Those were corrected before the production bundle was emitted, and the final TypeScript invocation passed. Logs: `/tmp/planarmto-r5/validation.log`, `/tmp/planarmto-r5/lint-final.log` and `/tmp/planarmto-r5/browser.log`.

The accepted-build probe passed, and the eight targeted refined browser cases passed with synthetic traces under `/tmp/planarmto-r5/refined-artifacts`. The first targeted iteration identified a four-quadrillionths-of-a-foot coordinate subtraction discrepancy in the new rectangle test. The test now compares derived coordinate differences to 10 decimal places, retains the exact displayed quantity check, and compares export and redo records directly. The first log is preserved at `/tmp/planarmto-r5/targeted-first.log`.

Docker is unavailable locally. Isolated WordPress must be verified by exact-candidate CI. Independent source review and real-plan owner acceptance remain open. The R5.3 review must approve the persistence contract before any implementation of it.
