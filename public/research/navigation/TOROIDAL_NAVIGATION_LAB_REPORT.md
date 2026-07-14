# Extended Toroidal ATS/AANA/AIx Dynamic Navigation Lab

## Status

This package extends the toroidal geometry work into a synthetic **prediction, monitoring, state-estimation, and control** program. It contains:

- 21 PNG visualizations and matching SVG files;
- raw and summary CSV outputs;
- a standalone Python runner;
- a compact headline-findings table;
- this interpretation report.

All evidence is synthetic model behavior. It does not establish that deployed AI systems, organizations, economies, or biological systems literally follow toroidal ATS dynamics.

## Experimental scope

- 260 base episodes for forecasting and telemetry analysis;
- 6 out-of-distribution families with 40 episodes each;
- 170 time steps per episode;
- 10-step telemetry windows;
- 20-step rupture forecast horizon;
- 220 matched scalar-score pairs;
- 260 matched counterfactual episodes per intervention;
- 80 episodes per timing offset;
- 120 episodes per control policy;
- 100 change-point episodes;
- up to 25 ruptured and 25 stable recurrence trajectories.

## 1. Dynamic state forecasting

The scalar alignment score was already predictive near the boundary (ROC-AUC **0.968**), but phase and dynamic state increased it to **0.986**. More importantly, full telemetry reduced Brier error from **0.083** to **0.037**, a relative reduction of **55.0%**.

| feature_set         |   roc_auc |   pr_auc |     brier |
|:--------------------|----------:|---------:|----------:|
| full_observable     |  0.990632 | 0.985241 | 0.037465  |
| phase_dynamic_state |  0.985798 | 0.978253 | 0.0479057 |
| dynamic_state       |  0.983002 | 0.974775 | 0.0555094 |
| A_plus_slope        |  0.978832 | 0.96916  | 0.0657096 |
| scalar_A            |  0.968103 | 0.956132 | 0.0833473 |

**Interpretation:** the largest practical gain is better-calibrated future risk, not merely a dramatic ranking improvement. AIx should evolve from a point score into a temporal state estimate.

## 2. Early-warning lead time

| alarm         |   median_lead |   detection_rate |
|:--------------|--------------:|-----------------:|
| radial_slope  |          18.5 |         0.994924 |
| margin        |          18   |         0.969543 |
| learned_risk  |          17   |         1        |
| low_alignment |           8   |         0.93401  |
| deformation   |           7   |         0.852792 |
| debt          |           5   |         0.411168 |

Radial slope warned a median **18** steps before rupture, compared with **8** for a low-alignment threshold.

**Operational implication:** monitor radial velocity, correction margin, and their trends. Waiting for the score itself to fall discards a substantial part of the warning interval in this model.

## 3. Same score, opposite futures

Matched systems began with the same instantaneous alignment. Low-debt, positive-margin states ruptured at rate **0.000**; high-debt, negative-margin states ruptured at rate **0.695**.

**Operational implication:** a scalar score is not a sufficient state description. At minimum, retain radial velocity, debt, correction margin, and recent trajectory.

## 4. Partial observability produced a useful negative result

|   noise_scale | method                         |   rho_rmse |   debt_rmse |
|--------------:|:-------------------------------|-----------:|------------:|
|           0.5 | instantaneous_pseudoinverse    |  0.0335158 |   0.0310856 |
|           0.5 | misspecified_model_observer    |  0.363645  |   0.471781  |
|           0.5 | regularized_telemetry_observer |  0.0883679 |   0.16506   |
|           1   | instantaneous_pseudoinverse    |  0.0664061 |   0.0605881 |
|           1   | misspecified_model_observer    |  0.3645    |   0.474704  |
|           1   | regularized_telemetry_observer |  0.0945142 |   0.171994  |
|           1.5 | instantaneous_pseudoinverse    |  0.0988128 |   0.0896966 |
|           1.5 | misspecified_model_observer    |  0.365693  |   0.47873   |
|           1.5 | regularized_telemetry_observer |  0.102983  |   0.179987  |
|           2   | instantaneous_pseudoinverse    |  0.130816  |   0.118328  |
|           2   | misspecified_model_observer    |  0.367203  |   0.483255  |
|           2   | regularized_telemetry_observer |  0.112985  |   0.18869   |
|           3   | instantaneous_pseudoinverse    |  0.194106  |   0.174567  |
|           3   | misspecified_model_observer    |  0.371221  |   0.493292  |
|           3   | regularized_telemetry_observer |  0.136154  |   0.207812  |

At high noise, temporal regularization improved radial estimation over instantaneous inversion. However, the reduced model-based observer drifted badly because it omitted irreversible loss and other hidden forcing.

**Operational implication:** a more sophisticated observer is not automatically safer. Observer validation, innovation monitoring, fallback telemetry, and model-mismatch alarms should be AANA requirements.

## 5. Telemetry value and redundancy

| removal_type   | removed                          |   roc_auc |    auc_drop |
|:---------------|:---------------------------------|----------:|------------:|
| group          | group:alignment_and_gating       |  0.98681  | 0.00382128  |
| group          | group:correction_debt_margin     |  0.988309 | 0.00232216  |
| group          | group:grounding_and_verification |  0.988805 | 0.00182666  |
| single         | gate_rejection                   |  0.989271 | 0.00136054  |
| single         | alignment_obs                    |  0.989695 | 0.000936424 |
| single         | verifier_disagreement            |  0.989997 | 0.000634081 |
| single         | correction_iterations            |  0.990014 | 0.000617284 |
| single         | grounding_error                  |  0.990052 | 0.000579491 |
| single         | tool_failure                     |  0.990081 | 0.000550097 |
| single         | debt_proxy                       |  0.990182 | 0.000449316 |
| group          | group:capability                 |  0.990237 | 0.000394726 |
| single         | capability                       |  0.990237 | 0.000394726 |

No single stream was indispensable. Removing the whole alignment-and-gating group caused the largest loss, followed by grounding-and-verification. Some removals slightly improved test AUC, indicating redundant or noisy channels.

**Operational implication:** design telemetry as a fault-tolerant ensemble and evaluate value at the sensor-group level.

## 6. Domain-shift robustness

| family                |   dynamic_state |   full_observable |   phase_dynamic_state |   scalar_A |
|:----------------------|----------------:|------------------:|----------------------:|-----------:|
| base_holdout          |        0.983002 |          0.990632 |              0.985798 |   0.968103 |
| correction_saturation |        0.98939  |          0.996494 |              0.993848 |   0.982643 |
| delayed_debt          |        0.983347 |          0.990395 |              0.986192 |   0.975415 |
| frequency_drift       |        0.988851 |          0.993226 |              0.990803 |   0.979118 |
| hidden_constraint     |        0.978356 |          0.982661 |              0.983415 |   0.970798 |
| higher_noise          |        0.974319 |          0.982988 |              0.978405 |   0.96162  |
| weak_feedback         |        0.978095 |          0.974041 |              0.973116 |   0.980381 |

The full telemetry model had the highest mean ROC-AUC across these synthetic families (**0.987**).

**Caution:** all families still share the same simulator. This is robustness across model variants, not validation in an external domain.

## 7. Missing and delayed telemetry

| missing_pattern   |   missing_rate | imputation           |   roc_auc |     brier |
|:------------------|---------------:|:---------------------|----------:|----------:|
| random            |            0.3 | within_window_linear | 0.991802  | 0.0336245 |
| random            |            0.5 | global_median        | 0.936434  | 0.127632  |
| random            |            0.5 | within_window_linear | 0.988459  | 0.0381052 |
| random            |            0.7 | within_window_linear | 0.977265  | 0.0653808 |
| contiguous_block  |            0.3 | within_window_linear | 0.99011   | 0.0363437 |
| contiguous_block  |            0.5 | global_median        | 0.934408  | 0.10851   |
| contiguous_block  |            0.5 | within_window_linear | 0.98822   | 0.0411385 |
| contiguous_block  |            0.7 | within_window_linear | 0.981404  | 0.055614  |
| trailing_recent   |            0.3 | within_window_linear | 0.983096  | 0.0522586 |
| trailing_recent   |            0.5 | global_median        | 0.0674173 | 0.558514  |
| trailing_recent   |            0.5 | within_window_linear | 0.968148  | 0.0781712 |
| trailing_recent   |            0.7 | within_window_linear | 0.945998  | 0.108927  |

Random missingness was comparatively easy. Loss of the newest observations was much more damaging under static median filling: at 50% trailing loss, AUC fell to **0.067**. Temporal interpolation/carry retained **0.968**.

**Operational implication:** telemetry freshness is itself a feedback constraint. A dashboard with stale recent data can be more dangerous than one with randomly sparse history.

## 8. Counterfactual intervention levers

| condition           |   rupture_rate |   final_alignment |   final_debt |   correction_cost |   mean_alignment |   rupture_reduction |
|:--------------------|---------------:|------------------:|-------------:|------------------:|-----------------:|--------------------:|
| none                |       0.842308 |          0.187688 |      9.85671 |             0     |         0.539197 |            0        |
| increase_correction |       0.419231 |          0.636308 |      1.56779 |             3.375 |         0.783141 |            0.423077 |
| increase_gamma      |       0.576923 |          0.481495 |      3.18591 |             0     |         0.685477 |            0.265385 |
| reduce_pressure     |       0.742308 |          0.287446 |      6.37471 |             0     |         0.591761 |            0.1      |
| combined            |       0.346154 |          0.699177 |      0.93802 |             2.475 |         0.827004 |            0.496154 |

The combined intervention reduced rupture from **0.842** to **0.346**.

**Operational implication:** AANA should coordinate three levers: increase correction capacity, improve feedback fidelity, and reduce optimization pressure when the stability margin becomes negative.

## 9. Equal-budget timing

|   offset |   rupture_rate |   final_alignment |   final_debt |   correction_cost |
|---------:|---------------:|------------------:|-------------:|------------------:|
|      -35 |         0.825  |          0.219378 |     10.448   |           1.8     |
|      -20 |         0.825  |          0.230095 |      9.87179 |           1.8     |
|       -5 |         0.7125 |          0.321154 |      7.3612  |           1.8     |
|       10 |         0.6    |          0.403889 |      5.30717 |           1.8     |
|       25 |         0.6    |          0.421195 |      5.52579 |           1.8     |
|       40 |         0.75   |          0.37303  |      8.26169 |           1.8     |
|       55 |         0.8125 |          0.291924 |     10.1989  |           1.8     |
|       70 |         0.8375 |          0.265627 |     10.8397  |           1.79906 |

The best tested pulse began **+10** steps relative to stress onset.

**Operational implication:** the right target is the recoverability window, not simply “intervene as early as possible.” Early pulses can expire before peak stress; late pulses encounter accumulated debt.

## 10. Policy comparison

| policy              |   rupture_rate |   mean_alignment |   final_debt |   correction_cost |   utility |
|:--------------------|---------------:|-----------------:|-------------:|------------------:|----------:|
| none                |     0.791667   |         0.541505 |   9.84914    |           0       |  0.106088 |
| fixed               |     0.541667   |         0.697673 |   2.90626    |           2.1     |  0.326256 |
| alignment_threshold |     0.075      |         0.827351 |   0.226291   |           4.14779 |  0.640929 |
| debt_aware          |     0.00833333 |         0.908239 |   0.0318189  |           5.04913 |  0.726936 |
| phase_aware         |     0.1        |         0.861002 |   0.262731   |           5.16163 |  0.625345 |
| mpc_like            |     0          |         0.969476 |   0.00309712 |           6.4257  |  0.744576 |

The highest mean joint utility was obtained by **mpc_like**. Phase-aware control did not dominate threshold or debt-aware control.

**Operational implication:** phase is useful context, not a complete control policy. Forecasting, phase estimation, and action selection must be evaluated separately.

## 11. Hidden-regime discovery

|   adjusted_rand_index |   mapped_accuracy |   n_samples |   n_regimes |
|----------------------:|------------------:|------------:|------------:|
|              0.422618 |          0.572859 |        3095 |           5 |

Operational regimes were only partly recoverable from telemetry.

**Operational implication:** dashboards should report probabilistic regime beliefs and ambiguity rather than forcing every state into a crisp label.

## 12. Change-point detection

| method           |   median_delay |   mean_delay |   detection_rate |   false_alarm_rate |
|:-----------------|---------------:|-------------:|-----------------:|-------------------:|
| CUSUM            |            3.5 |         3.8  |             1    |               0    |
| EWMA             |            9   |         9.5  |             1    |               0    |
| two_window_shift |            5   |         2.43 |             0.69 |               0.31 |

CUSUM detected synthetic hidden stress with median delay **3.5** and no false alarms in this run. The faster two-window method traded speed for false alarms.

**Operational implication:** distinguish high-sensitivity watch alerts from high-specificity intervention triggers.

## 13. Recurrence structure revealed lock-in, not simple disappearance

| group    |   relative_time |   recurrence_rate |   determinism |
|:---------|----------------:|------------------:|--------------:|
| ruptured |             -70 |          0.14321  |      0.613793 |
| ruptured |             -63 |          0.12     |      0.60965  |
| ruptured |             -56 |          0.118765 |      0.594713 |
| ruptured |             -49 |          0.133926 |      0.609374 |
| ruptured |             -42 |          0.133926 |      0.603875 |
| ruptured |             -35 |          0.136816 |      0.605505 |
| ruptured |             -28 |          0.133892 |      0.605836 |
| ruptured |             -21 |          0.14177  |      0.636698 |
| ruptured |             -14 |          0.155299 |      0.715684 |
| ruptured |              -7 |          0.167941 |      0.769559 |
| ruptured |               0 |          0.169047 |      0.827916 |
| stable   |             -70 |          0.159881 |      0.733755 |
| stable   |             -63 |          0.150005 |      0.709497 |
| stable   |             -56 |          0.147674 |      0.703363 |
| stable   |             -49 |          0.14803  |      0.693713 |
| stable   |             -42 |          0.149057 |      0.693438 |
| stable   |             -35 |          0.145936 |      0.675377 |
| stable   |             -28 |          0.147279 |      0.680549 |
| stable   |             -21 |          0.145738 |      0.697964 |
| stable   |             -14 |          0.144316 |      0.730662 |
| stable   |              -7 |          0.143881 |      0.727094 |
| stable   |               0 |          0.144    |      0.705968 |

Contrary to a simple recurrence-loss hypothesis, determinism in rupturing trajectories changed from **0.614** to **0.828** near failure, while stable trajectories remained near **0.705**.

**Interpretation:** collapse in this model can become more repetitive and rigid. The system locks into a failure channel rather than becoming purely disordered. Monitoring should look for both recurrence loss and excessive phase locking.

## Overall findings

1. **Dynamic state beats scalar state.** The strongest evidence is the matched-score experiment and the earlier warning from velocity and margin.
2. **Calibration matters.** Dynamic telemetry reduced probability error more than it improved ranking AUC.
3. **Debt distinguishes futures but is a late standalone alarm.** It helps describe hidden state, yet simple debt thresholds detected fewer imminent ruptures than slope or margin.
4. **Phase adds modest predictive value.** It helps when risk is phase-dependent, but phase-aware control was not best.
5. **Model-based observers can fail under mismatch.** State estimation requires validation and robust fallback.
6. **Recent telemetry is disproportionately valuable.** Structured loss of the newest data is more dangerous than random missingness.
7. **Control is not forecasting.** The best predictor, earliest alarm, and best policy are different objects.
8. **Pre-failure behavior may become rigid.** Watch for maladaptive synchronization, not only noise or loss of periodicity.

## Figure guide

- `fig_01`–`fig_03`: prediction and warning lead time;
- `fig_04`: same score, divergent futures;
- `fig_05`–`fig_06`: deformation and margin/debt risk;
- `fig_07`–`fig_08b`: partial observability and observer mismatch;
- `fig_09`: telemetry value of information;
- `fig_10`–`fig_11`: OOD and missing-data robustness;
- `fig_12`–`fig_15`: interventions, timing, and policies;
- `fig_16`–`fig_17`: hidden regimes and transitions;
- `fig_18`–`fig_19`: change-point detection;
- `fig_20`: recurrence restructuring near rupture.

## Limitations

- All tests inherit the simulator’s equations and parameter choices.
- Episode-level splitting reduces leakage but does not remove design dependence.
- Intervention effects are exact simulator counterfactuals, not estimates from observational data.
- Phase is meaningful because the simulator contains recurrent external forcing.
- The recurrence-locking result partly reflects assumed nonlinear saturation and state-dependent phase disturbance.
- The model observer is intentionally lower-dimensional than the full simulator; its failure is a warning about mismatch, not a general result against Kalman filtering.
