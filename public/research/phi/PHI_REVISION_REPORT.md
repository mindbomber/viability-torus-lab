# Revised AIx External-Phase Validation

This targeted synthetic test evaluates the external adaptation phase formula in the toroidal ATS/AANA/AIx paper.
It is model-behavior evidence, not empirical confirmation of real systems.

## Algebraic finding

The previous formula was

`phi_AIx = atan2(A_dot, C-D)`.

Under the paper's core identity `A_dot = C-D`, its two arguments are identical. The estimator therefore collapses to pi/4 when the correction margin is positive and 5pi/4 when it is negative (undefined at zero). It cannot represent a continuous full-cycle phase.

## Revised estimator

Let `m_phi(t)` be an observable external adaptation mismatch, such as `1-I_phi`, and let `m_tilde` be its locally centered value. The revised mechanistic estimator is

`phi_AIx = atan2(-tau_phi * d(m_tilde)/dt, m_tilde) mod 2pi`,

where `tau_phi = 1/omega_phi` and `omega_phi` is estimated from the dominant recurrence frequency. For empirical time series, a Hilbert-phase estimator is also tested.

## Noise SD = 0.05 results

| Method | Mean absolute circular error (rad) | Phase locking value |
|---|---:|---:|
| Old degenerate | 0.7927 | 0.6304 |
| Revised phase-plane | 0.1852 | 0.9754 |
| Hilbert temporal | 0.1153 | 0.9896 |

## Identifiability gate

| signal          |   spectral_concentration |   estimated_cycles | phase_identifiable   |
|:----------------|-------------------------:|-------------------:|:---------------------|
| recurrent_cycle |                 0.457814 |                131 | True                 |
| single_shock    |                 0.123262 |                  7 | False                |
| ar1_noise       |                 0.137746 |                 30 | False                |
| flat_noise      |                 0.061319 |                 42 | False                |

## Interpretation

The revision solves the algebraic degeneracy and recovers the latent external phase under moderate noise. The result also clarifies that a phase is not generally identifiable from one static AIx snapshot. It requires either two independent signed quadrature observables or a temporal window. When recurrence is weak or absent, the phase should be reported as undefined rather than forced.
