import type { ScenarioDefinition } from "../contracts/types.ts";
import type { SimulationParameters } from "../engine/simulator.ts";

export type ParameterEducation = {
  key: keyof SimulationParameters;
  symbol: string;
  modelRole: string;
  realWorldEquivalent: string;
  scale: string;
  predictedEffect: string;
};

export function parameterEducationFor(
  scenario: ScenarioDefinition,
  parameters: SimulationParameters,
): { primary: ParameterEducation[]; advanced: ParameterEducation[] } {
  const radial = scenario.labels.radialExcursion.toLowerCase();
  const minor = scenario.cycles.minor.label;
  const major = scenario.cycles.major.label;
  const rows: ParameterEducation[] = [
    { key: "pressure", symbol: "π", modelRole: "Multiplies ε and (1−γ) inside divergence D.", realWorldEquivalent: scenario.labels.pressure, scale: "Relative intensity: 0 means absent; 1 is the scenario reference level; values above 1 are stronger pressure.", predictedEffect: "Lower π reduces D when error is present and feedback is incomplete." },
    { key: "error", symbol: "ε", modelRole: "The constraint-error share inside D = π·ε·(1−γ)+Φ+Λ.", realWorldEquivalent: scenario.labels.error, scale: "A 0–1 illustrative fraction: 0 means no modeled error; 1 means maximum error exposure.", predictedEffect: "Lower ε reduces pressure that escapes correction." },
    { key: "feedback", symbol: "γ", modelRole: "Discounts pressure-driven divergence through (1−γ).", realWorldEquivalent: scenario.labels.feedback, scale: "A 0–1 composite of coverage, reliability, and timeliness; 1 is fully effective modeled feedback.", predictedEffect: "Higher γ makes consequences visible sooner and reduces D." },
    { key: "correction", symbol: "C", modelRole: "Subtracts from divergence in dρ/dt and helps repay debt.", realWorldEquivalent: scenario.labels.correction, scale: "Capacity relative to the scenario reference divergence: 0 is none; values above 1 represent reserve capacity.", predictedEffect: "Higher C improves the correction margin and can contract excursion." },
    { key: "drift", symbol: "Φ", modelRole: "Adds directly to D as movement of the viable region.", realWorldEquivalent: scenario.labels.drift, scale: "Modeled change per adaptation cycle, from stationary at 0 to rapid change at 0.5.", predictedEffect: "Lower Φ gives correction more time; adaptation can also raise effective C or γ." },
    { key: "initialDebt", symbol: "Δ₀", modelRole: "Sets starting alignment debt; χΔ then adds radial pressure.", realWorldEquivalent: scenario.labels.initialDebt, scale: "Backlog relative to a modeled recovery cycle: 0 means no inherited debt; 2 is a severe illustrative backlog.", predictedEffect: "Lower Δ₀ reduces path dependence and the initial debt penalty." },
    { key: "irreversibleLoss", symbol: "Λ", modelRole: "Adds to D and accumulates toward the terminal-loss gate.", realWorldEquivalent: scenario.labels.irreversibleLoss, scale: "Permanent modeled loss per unit time, from 0 to 0.5; it is not a measured domain probability.", predictedEffect: "Lower Λ preserves recoverability even when the boundary is crossed." },
    { key: "kappa", symbol: "κ", modelRole: "Restores ρ toward the reference excursion ρ₀.", realWorldEquivalent: scenario.labels.restoration, scale: "Restorative rate per unit time; larger values pull the system back faster.", predictedEffect: "Higher κ strengthens passive recovery when ρ is above ρ₀." },
    { key: "chi", symbol: "χ", modelRole: "Converts accumulated debt Δ into additional radial pressure χΔ.", realWorldEquivalent: scenario.labels.debtCoupling, scale: "Sensitivity of current viability to each unit of modeled debt.", predictedEffect: "Lower χ insulates current performance from inherited debt; repaying Δ attacks the source." },
    { key: "rho0", symbol: "ρ₀", modelRole: "The normal restorative excursion in −κ(ρ−ρ₀), not a risk score.", realWorldEquivalent: `Reference operating distance for ${radial}`, scale: "Scenario reference on the same dimensionless radial scale as ρ.", predictedEffect: "A lower defensible ρ₀ represents a healthier operating reference, but should be calibrated rather than optimized arbitrarily." },
    { key: "rhoCrit", symbol: "ρcrit", modelRole: "Defines the modeled viability-boundary crossing.", realWorldEquivalent: `The scenario-defined recoverability limit for ${radial}`, scale: "A synthetic threshold that requires external calibration before real-world use.", predictedEffect: "Changing the threshold changes classification, not the underlying system; it is a definition to validate, not an intervention." },
    { key: "alpha", symbol: "α", modelRole: "Controls how quickly negative correction margin accumulates debt.", realWorldEquivalent: `Rate at which unresolved ${scenario.labels.error.toLowerCase()} becomes ${scenario.labels.initialDebt.toLowerCase()}`, scale: "Debt-accumulation response per unit time.", predictedEffect: "Lower α slows new debt formation without repairing existing debt." },
    { key: "beta", symbol: "β", modelRole: "Controls how efficiently positive correction margin repays debt.", realWorldEquivalent: `Effectiveness of reducing ${scenario.labels.initialDebt.toLowerCase()}`, scale: "Debt-repayment response per unit time.", predictedEffect: "Higher β lets sustained corrective surplus remove debt faster." },
    { key: "omegaTheta", symbol: "ωθ", modelRole: "Advances the local recurrent phase θ.", realWorldEquivalent: `Cadence of ${minor}`, scale: "Angular phase speed per unit time.", predictedEffect: "Changes how quickly local cycles repeat; it does not directly improve alignment." },
    { key: "omegaPhi", symbol: "ωφ", modelRole: "Advances the external recurrent phase φ.", realWorldEquivalent: `Cadence of ${major}`, scale: "Angular phase speed per unit time.", predictedEffect: "Changes exposure timing and phase relationships, not the correction margin by itself." },
    { key: "couplingA", symbol: "a", modelRole: "Lets external phase φ modulate local phase θ.", realWorldEquivalent: `How strongly ${major} changes the timing of ${minor}`, scale: "Dimensionless phase-coupling strength.", predictedEffect: "Higher coupling can synchronize cycles; synchronization is not automatically alignment." },
    { key: "couplingB", symbol: "b", modelRole: "Lets local phase θ modulate external phase φ.", realWorldEquivalent: `How strongly ${minor} feeds back into ${major}`, scale: "Dimensionless reciprocal phase-coupling strength.", predictedEffect: "Higher coupling changes recurrence geometry and timing, not viability directly." },
    { key: "seed", symbol: "seed", modelRole: "Selects a repeatable synthetic noise realization.", realWorldEquivalent: "One plausible ordering of small unmodeled disturbances", scale: "Integer reproducibility control, not a physical quantity.", predictedEffect: "Changing it tests sensitivity to stochastic variation without changing the structural assumptions." },
    { key: "steps", symbol: "N", modelRole: "Sets the simulation horizon.", realWorldEquivalent: "How many modeled observation steps are followed", scale: "Count of integration outputs.", predictedEffect: "A longer horizon can reveal slow debt or loss; it does not change causal rates." },
    { key: "dt", symbol: "Δt", modelRole: "Sets simulated time represented by each output step.", realWorldEquivalent: "Time resolution after domain calibration", scale: "Dimensionless simulated time per output step.", predictedEffect: "It changes numerical sampling and total horizon; it is not a real-world lever." },
  ];
  const primaryKeys = new Set<keyof SimulationParameters>([
    "pressure", "feedback", "correction", "error", "initialDebt", "drift", "irreversibleLoss",
  ]);
  const withValues = rows.map((row) => ({
    ...row,
    modelRole: `${row.modelRole} Current value: ${parameters[row.key]}.`,
  }));
  return {
    primary: withValues.filter((row) => primaryKeys.has(row.key)),
    advanced: withValues.filter((row) => !primaryKeys.has(row.key)),
  };
}
