# Toroidal ATS/AANA/AIx Python Research Lab Report

This run tests the synthetic claims in the toroidal ATS/AANA/AIx paper. It is model-behavior evidence, not empirical validation of real systems.

## Regime summary

| regime                 |     T |   mean_rho_last |   max_rho |   outside_fraction |   final_debt |   mean_alignment_last |   w_theta |     w_phi |   winding_ratio |   mean_D |   mean_C |   correction_margin |
|:-----------------------|------:|----------------:|----------:|-------------------:|-------------:|----------------------:|----------:|----------:|----------------:|---------:|---------:|--------------------:|
| stable_periodic        |  7000 |      0.00181818 |      0.22 |           0        |       0      |            0.998183   | 0.0318253 | 0.0159127 |         2       |    0.145 |    0.157 |               0.012 |
| stable_quasiperiodic   | 12000 |      0.00181818 |      0.22 |           0        |       0      |            0.998183   | 0.0334207 | 0.0236325 |         1.41419 |    0.145 |    0.157 |               0.012 |
| neutral_tube           |  7000 |      0.22       |      0.22 |           0        |       0      |            0.802519   | 0.0334161 | 0.0236281 |         1.41425 |    0.145 |    0.145 |               0     |
| rupture_low_correction |  7000 |      7.2795     |      8    |           0.993429 |      30.7956 |            0.00184915 | 0.0334097 | 0.0236299 |         1.41387 |    0.145 |    0.09  |              -0.055 |

## Topology diagnostic

Phase-grid cubical homology is used because ripser/gudhi are not required. A densely occupied phase torus should show beta=(1,2,1); a single loop should show roughly beta=(1,1,0).

| case                 |   occupancy_fraction |   b0 |   b1 |   b2 |   n_vertices |   n_edges |   n_faces |   rank_d1 |   rank_d2 |
|:---------------------|---------------------:|-----:|-----:|-----:|-------------:|----------:|----------:|----------:|----------:|
| quasiperiodic_torus  |             1        |    1 |    2 |    1 |         1600 |      3200 |      1600 |      1599 |      1599 |
| periodic_single_loop |             0.225    |    1 |    1 |    0 |          480 |       840 |       360 |       479 |       360 |
| one_cycle_null       |             0.075    |    1 |    1 |    0 |          160 |       280 |       120 |       159 |       120 |
| random_sparse_null   |             0.244375 |  112 |    1 |    0 |         1103 |      1383 |       391 |       991 |       391 |

## AIx phase recovery

|   theta_mean_abs_circular_error |   phi_paper_mean_abs_circular_error |   phi_signed_mean_abs_circular_error |    rho_rmse |
|--------------------------------:|------------------------------------:|-------------------------------------:|------------:|
|                        0.158141 |                             1.57036 |                            0.0396443 | 0.000375399 |

Note: the paper's raw phi formula uses A as an atan2 numerator. Since A is nonnegative, that formula cannot recover a full 0..2pi phase without an additional signed dynamical coordinate. The run therefore reports both the raw paper formula and a signed-coordinate extension.

## Hysteresis threshold summary

|   stress_duration |   C_recover_min |   C_prevent |   hysteresis_gap |
|------------------:|----------------:|------------:|-----------------:|
|                20 |        0.142778 |        0.17 |      -0.0272222  |
|                45 |        0.151667 |        0.17 |      -0.0183333  |
|                70 |        0.160556 |        0.17 |      -0.00944444 |
|                95 |        0.178333 |        0.17 |       0.00833333 |
|               120 |        0.187222 |        0.17 |       0.0172222  |
|               145 |        0.196111 |        0.17 |       0.0261111  |
|               170 |        0.205    |        0.17 |       0.035      |
|               195 |        0.222778 |        0.17 |       0.0527778  |
|               220 |        0.231667 |        0.17 |       0.0616667  |

## Key figure guide

- fig_01: stable quasiperiodic 3D torus trajectory.
- fig_04: unwrapped quasiperiodic phase winding.
- fig_05/06: Poincare sections for periodic vs quasiperiodic regimes.
- fig_10/11: radial stability and rupture heatmaps over C and gamma.
- fig_12/13: debt-driven recovery threshold and recovery basin.
- fig_14/16: spectral route and regime map.
- fig_17/20: AIx phase and radius recovery tests.
- fig_21-25: topology diagnostics via phase-grid homology.
- fig_26: coupled-agent synchronization versus risk.
